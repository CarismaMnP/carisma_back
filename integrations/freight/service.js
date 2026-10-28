const crypto = require('crypto');
const {Op} = require('sequelize');
const {sequelize} = require('../../db');
const {Product,FreightQuote} = require('../../models/models');
const {productProfile, VERSION} = require('./profiles');
const provider = require('./savtrans');
const TTL = 30*60*1000;
function destination(input) {
  const zip = String(input?.zip || '').trim();
  if (!/^\d{5}$/.test(zip)) throw Error('Enter a valid 5-digit US ZIP code');
  if (!['residential','business'].includes(input?.addressType)) throw Error('Choose a residential or business address');
  if (input.limitedAccess !== undefined && typeof input.limitedAccess !== 'boolean') throw Error('Invalid delivery access');
  return {zip,addressType:input.addressType,limitedAccess:!!input.limitedAccess};
}
function shippingAddress(input,zip) {
  const fields={};
  for (const key of ['line1','line2','city','state','postal_code','country']) {
    if (input?.[key] != null && typeof input[key] !== 'string') throw Error('Invalid shipping address');
    fields[key]=String(input?.[key] || '').trim();
    if (fields[key].length>200) throw Error('Shipping address is too long');
  }
  fields.country=fields.country.toUpperCase(); fields.state=fields.state.toUpperCase();
  const states='AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
  if (!fields.line1 || !fields.city || !states.includes(fields.state) || fields.country!=='US' ||
    !/^\d{5}(?:-\d{4})?$/.test(fields.postal_code) || fields.postal_code.slice(0,5)!==zip)
    throw Error('Enter the complete US delivery address matching the quoted ZIP code');
  return fields;
}
function basket(products,items) {
  if (products.length !== items.length) throw Error('A product is no longer available');
  return items.map(item=>{
    const p=products.find(x=>x.id===item.productId);
    if (!p || p.isDeleted || p.adminHidden || p.websiteSold || p.count<item.count || !(p.price>0) || p.source==='legacy')
      throw Error('A product is no longer available in this quantity');
    if (p.source==='carparts' && item.count!==1) throw Error('This part is a single inventory item');
    return {productId:p.id,name:p.name,count:item.count,unitPriceCents:Math.round(p.price*100),profile:productProfile(p)};
  });
}
function buildRequest(rows,input) {
  const dest=destination(input);
  const shipmentItems=rows.flatMap(row=>row.profile ? Array.from({length:row.count},()=>({
    productId:row.productId,name:row.name,unitPriceCents:row.unitPriceCents,...row.profile})) : []);
  if (!shipmentItems.length) throw Error('This cart does not require freight shipping');
  if (shipmentItems.length>20) throw Error('For more than 20 large parts, please contact us or choose pickup');
  return {version:VERSION,originZip:'32209',...dest,
    accessorials:[4,...(dest.addressType==='residential'?[8]:[]),...(dest.limitedAccess?[7]:[])],
    insuredCents:shipmentItems.reduce((sum,x)=>sum+x.unitPriceCents,0),
    cart:rows.map(({productId,count,unitPriceCents,profile})=>({productId,count,unitPriceCents,code:profile?.code || null})),shipmentItems};
}
const fingerprint=request=>crypto.createHash('sha256').update(JSON.stringify(request)).digest('hex');
function publicQuote(q) {
  return {id:q.id,amountCents:q.amountCents,currency:'USD',expiresAt:q.expiresAt,
    carrier:q.result.selected.carrier,transitDays:q.result.selected.transitDays,transitDaysMax:q.result.selected.transitDaysMax,
    insuredCents:q.request.insuredCents,insuranceCents:q.result.insuranceCents,
    zip:q.request.zip,addressType:q.request.addressType,limitedAccess:q.request.limitedAccess,
    packageCount:q.request.shipmentItems.length};
}
async function loadBasket(input) {
  const items=require('../carparts/orders').orderItems(input);
  const products=await Product.findAll({where:{id:{[Op.in]:items.map(x=>x.productId)}},order:[['id','ASC']]});
  return {rows:basket(products,items),products,items};
}
async function requirements(input) {
  const {rows,products}=await loadBasket(input);
  return {requiresParcel:require('../parcel/fedex').enabled()&&rows.some(x=>!x.profile),
    parcelMissingMeasurements:products.filter(p=>!productProfile(p)&&!require('../parcel/packages').productPackage(p)).map(p=>p.id),
    requiresFreight:rows.some(x=>x.profile),subtotalCents:rows.reduce((sum,x)=>sum+x.unitPriceCents*x.count,0),
    items:rows.map(x=>({productId:x.productId,name:x.name,count:x.count,unitPriceCents:x.unitPriceCents,
      freight:x.profile ? {code:x.profile.code,label:x.profile.label} : null})),originZip:'32209'};
}
async function createQuote(userId,input) {
  const {rows}=await loadBasket(input.products);
  const request=buildRequest(rows,input), hash=fingerprint(request);
  // Persistent per-user lock and limits prevent double-clicks, multiple API workers,
  // and restarts from creating unbounded broker quotes. No inventory is reserved here.
  let created;
  const output=await sequelize.transaction(async transaction=>{
    const [[lock]]=await sequelize.query('SELECT pg_try_advisory_xact_lock(9032019, :userId) AS acquired',
      {replacements:{userId},transaction});
    if (!lock.acquired) throw Error('A freight calculation is already running. Please wait.');
    const cached=await FreightQuote.findOne({where:{userId,fingerprint:hash,status:'quoted',expiresAt:{[Op.gt]:new Date(Date.now()+120000)}},
      order:[['createdAt','DESC']],transaction});
    if (cached) return cached;
    const pending=await FreightQuote.count({where:{userId,status:'requested',createdAt:{[Op.gt]:new Date(Date.now()-120000)}},transaction});
    if (pending) throw Error('A freight calculation is already running. Please wait.');
    // Serialize account-wide admission briefly; never hold this lock during HTTP.
    await sequelize.query('SELECT pg_advisory_xact_lock(9032020)',{transaction});
    const concurrent=await FreightQuote.count({where:{status:'requested',createdAt:{[Op.gt]:new Date(Date.now()-120000)}},transaction});
    if (concurrent>=4) throw Error('Freight rates are busy. Please try again shortly.');
    const since=new Date(Date.now()-3600000);
    const own=await FreightQuote.count({where:{userId,createdAt:{[Op.gt]:since}},transaction});
    const global=await FreightQuote.count({where:{createdAt:{[Op.gt]:since}},transaction});
    if (own>=20 || global>=200) throw Error('Freight calculation limit reached. Please try again later or contact us.');
    created=await FreightQuote.create({userId,fingerprint:hash,request,status:'requested'},{transaction});
    return null;
  });
  if (output) return publicQuote(output);
  // A second request sees this committed state even while the HTTP call is in flight.
  try {
    const result=await provider.calculate(request);
    await created.update({status:'quoted',result,amountCents:result.selected.amountCents,expiresAt:new Date(Date.now()+TTL)});
    return publicQuote(created);
  } catch(error) {
    await created.update({status:'failed',error:String(error.message).slice(0,500)});
    throw error;
  }
}
async function checkoutShipping(data,products,items,transaction) {
  if (!['ups','pickup','freight'].includes(data.delivey_type)) throw Error('Choose delivery or self-pickup');
  const rows=basket(products,items), requiresFreight=rows.some(x=>x.profile);
  if (data.delivey_type==='pickup') return {shippingExpectedCents:0,shippingAmount:0};
  if (!requiresFreight) {
    if (data.delivey_type==='freight') throw Error('This cart no longer requires freight. Refresh checkout.');
    return {shippingExpectedCents:0,shippingAmount:0};
  }
  if (data.delivey_type!=='freight' || !/^[0-9a-f-]{36}$/i.test(data.freightQuoteId || ''))
    throw Error('Calculate freight shipping or choose self-pickup before payment');
  const q=await FreightQuote.findOne({where:{id:data.freightQuoteId,userId:data.userId},transaction,lock:transaction.LOCK.UPDATE});
  if (!q || q.status!=='quoted' || Date.parse(q.expiresAt)<=Date.now()) throw Error('The freight quote has expired. Please calculate again.');
  const request=buildRequest(rows,data.freightDestination);
  if (fingerprint(request)!==q.fingerprint) throw Error('Your cart or delivery details changed. Please calculate freight again.');
  const address=shippingAddress(data.freightAddress,request.zip);
  const location=await require('./addresses').lookupZip(request.zip);
  if(location.places.length&&!location.places.some(x=>x.state===address.state))
    throw Error('The delivery state does not match the quoted ZIP code');
  if (!Number.isSafeInteger(q.amountCents) || q.amountCents<=0) throw Error('Invalid freight quote');
  return {freightQuoteId:q.id,freightSnapshot:{request:q.request,result:q.result,quotedAt:q.createdAt,expiresAt:q.expiresAt},
    freightAddress:address,shippingAddress:address,shippingExpectedCents:q.amountCents,shippingAmount:q.amountCents/100,
    country:address.country,city:address.city,zip_code:address.postal_code,addressState:address.state,
    address_line_1:address.line1,address_line_2:address.line2};
}
module.exports={loadBasket,requirements,createQuote,checkoutShipping,buildRequest,basket,destination,shippingAddress,fingerprint,publicQuote};
