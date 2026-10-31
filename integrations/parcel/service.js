const {Op}=require('sequelize');
const {sequelize}=require('../../db');
const {ParcelQuote}=require('../../models/models');
const freight=require('../freight/service');
const provider=require('./fedex');
const {productPackage}=require('./packages');
const TTL=30*60*1000;
function buildRequest(rows,products,input,version=2) {
 const dest=freight.destination({...input,addressType:version===1?input.addressType:'residential'});
 const address=freight.shippingAddress(input.address,dest.zip);
 if(/\b(?:p\.?\s*o\.?\s*box|post\s+office\s+box)\b/i.test(address.line1))throw Error('FedEx requires a street address, not a PO Box');
 const packages=rows.flatMap(row=>{
  if(row.profile)return [];
  const pack=productPackage(products.find(x=>x.id===row.productId));
  if(!pack)throw Error('Packed measurements are not yet available for '+row.name+'. Contact us for shipping or choose self-pickup.');
  return Array.from({length:row.count},()=>({productId:row.productId,unitPriceCents:row.unitPriceCents,...pack}));
 });
 if(!packages.length||packages.length>20)throw Error('Online parcel quotes support 1–20 packages. Contact us for larger shipments.');
 const c=provider.config();
 return {version,environment:c.environment,accountFingerprint:freight.fingerprint(c.account||''),
  origin:{streetLines:['1300 W Beaver St'],city:'Jacksonville',stateOrProvinceCode:'FL',postalCode:'32209',countryCode:'US',residential:false},
  shipDate:provider.shipDate(),pickupType:c.pickupType,address,addressType:version===1?dest.addressType:'automatic',packages,
  cart:rows.map(({productId,count,unitPriceCents,profile})=>({productId,count,unitPriceCents,code:profile?.code||null}))};
}
function publicQuote(q){return {id:q.id,amountCents:q.amountCents,currency:'USD',expiresAt:q.expiresAt,
 carrier:'FedEx',serviceName:q.result.selected.serviceName,serviceType:q.result.selected.serviceType,
 transitTime:q.result.selected.transitTime,deliveryDate:q.result.selected.deliveryDate,packageCount:q.request.packages.length,
 addressSuggestion:q.result.validation?.suggestedAddress||null,addressWarnings:q.result.validation?.warnings||[]};}
async function createQuote(userId,input) {
 if(!provider.enabled())throw Error('FedEx online rates are not enabled yet');
 const {rows,products}=await freight.loadBasket(input.products);
 const request=buildRequest(rows,products,input),hash=freight.fingerprint(request);
 let created;
 const cached=await sequelize.transaction(async transaction=>{
  const [[lock]]=await sequelize.query('SELECT pg_try_advisory_xact_lock(9032029, :userId) AS acquired',{replacements:{userId},transaction});
  if(!lock.acquired)throw Error('A shipping calculation is already running. Please wait.');
  const existing=await ParcelQuote.findOne({where:{userId,fingerprint:hash,status:'quoted',expiresAt:{[Op.gt]:new Date(Date.now()+120000)}},order:[['createdAt','DESC']],transaction});
  if(existing)return existing;
  await sequelize.query('SELECT pg_advisory_xact_lock(9032030)',{transaction});
  const since=new Date(Date.now()-3600000),recent=new Date(Date.now()-120000);
  const pending=await ParcelQuote.count({where:{status:'requested',createdAt:{[Op.gt]:recent}},transaction});
  const ownPending=await ParcelQuote.count({where:{userId,status:'requested',createdAt:{[Op.gt]:recent}},transaction});
  const own=await ParcelQuote.count({where:{userId,createdAt:{[Op.gt]:since}},transaction});
  const total=await ParcelQuote.count({where:{createdAt:{[Op.gt]:since}},transaction});
  if(ownPending||pending>=6||own>=20||total>=300)throw Error('Shipping rate limit reached. Please try again shortly.');
  created=await ParcelQuote.create({userId,environment:request.environment,fingerprint:hash,request,status:'requested'},{transaction});
  return null;
 });
 if(cached)return publicQuote(cached);
 try {
  const result=await provider.calculate(request);
  if(result.virtual||request.environment!=='production')throw Error('Test FedEx quotes cannot be charged to customers');
  await created.update({status:'quoted',result,amountCents:result.selected.amountCents,expiresAt:new Date(Date.now()+TTL)});
  return publicQuote(created);
 }catch(e){await created.update({status:'failed',error:String(e.message).slice(0,500),...(e.addressSuggestion?{result:{addressSuggestion:e.addressSuggestion}}:{})});throw e;}
}
async function checkoutShipping(data,products,items,transaction) {
 const base=await freight.checkoutShipping(data,products,items,transaction);
 if(data.delivey_type==='pickup')return base;
 const rows=freight.basket(products,items),hasParcel=rows.some(x=>!x.profile);
 const required=hasParcel&&provider.enabled();
 // Site-collected address is used even before FedEx is activated. Legacy clients
 // can finish their existing flow while the feature is disabled.
 let address=base.shippingAddress;
 if(data.shippingAddress)address=freight.shippingAddress(data.shippingAddress,String(data.shippingAddress.postal_code||'').slice(0,5));
 if(base.shippingAddress&&address&&JSON.stringify(address)!==JSON.stringify(base.shippingAddress))throw Error('Delivery addresses must match');
 let parcel={};
 if(required) {
  if(!address||!/^[0-9a-f-]{36}$/i.test(data.parcelQuoteId||''))throw Error('Calculate FedEx shipping before payment');
  const q=await ParcelQuote.findOne({where:{id:data.parcelQuoteId,userId:data.userId},transaction,lock:transaction.LOCK.UPDATE});
  if(!q||q.status!=='quoted'||Date.parse(q.expiresAt)<=Date.now()||q.environment!=='production'||q.result?.virtual)
   throw Error('The FedEx quote has expired. Please calculate again.');
  // Keep unexpired v1 quotes usable during a rolling frontend deployment.
  const version=q.request.version===1?1:2;
  const request=buildRequest(rows,products,{zip:address.postal_code.slice(0,5),addressType:data.addressType??q.request.addressType,address},version);
  if(freight.fingerprint(request)!==q.fingerprint)throw Error('Your cart, package measurements or address changed. Calculate shipping again.');
  if(!Number.isSafeInteger(q.amountCents)||q.amountCents<=0)throw Error('Invalid shipping quote');
  parcel={parcelQuoteId:q.id,parcelSnapshot:{request:q.request,result:q.result,quotedAt:q.createdAt,expiresAt:q.expiresAt},
   shippingExpectedCents:base.shippingExpectedCents+q.amountCents,shippingAmount:(base.shippingExpectedCents+q.amountCents)/100};
 }else if(data.parcelQuoteId)throw Error('FedEx shipping settings changed. Refresh checkout.');
 if(!address)return base;
 return {...base,...parcel,shippingAddress:address,country:address.country,city:address.city,zip_code:address.postal_code,
  addressState:address.state,address_line_1:address.line1,address_line_2:address.line2};
}
async function list(page=1){page=Math.max(1,Math.min(10000,parseInt(page,10)||1));return {...await ParcelQuote.findAndCountAll({order:[['createdAt','DESC'],['id','DESC']],limit:25,offset:(page-1)*25}),page};}
module.exports={buildRequest,createQuote,checkoutShipping,publicQuote,list};
