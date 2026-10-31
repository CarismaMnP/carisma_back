const axios=require('axios');
let tokenCache,tokenPending;
const SERVICES=new Set(['FEDEX_GROUND','GROUND_HOME_DELIVERY','FEDEX_EXPRESS_SAVER','FEDEX_2_DAY','FEDEX_2_DAY_AM','STANDARD_OVERNIGHT','PRIORITY_OVERNIGHT','FIRST_OVERNIGHT']);
function config() {
 const environment=process.env.FEDEX_ENVIRONMENT==='production'?'production':'sandbox';
 return {environment,base:environment==='production'?'https://apis.fedex.com':'https://apis-sandbox.fedex.com',
  key:process.env.FEDEX_API_KEY,secret:process.env.FEDEX_SECRET_KEY,account:process.env.FEDEX_ACCOUNT_NUMBER,
  pickupType:process.env.FEDEX_PICKUP_TYPE||'DROPOFF_AT_FEDEX_LOCATION'};
}
function enabled(){const c=config();return process.env.FEDEX_CHECKOUT_ENABLED==='true' && c.environment==='production' && !!(c.key&&c.secret&&/^\d{9}$/.test(c.account||''));}
const http={timeout:20000,maxRedirects:0,maxContentLength:2000000,maxBodyLength:250000};
async function accessToken(c=config()) {
 if(!c.key||!c.secret)throw Error('FedEx credentials are not configured');
 const identity=c.base+':'+c.key+':'+c.secret;
 if(tokenCache?.identity===identity&&tokenCache.until>Date.now()+60000)return tokenCache.value;
 if(tokenPending?.identity===identity)return tokenPending.promise;
 const promise=(async()=>{
  try {
   const {data}=await axios.post(c.base+'/oauth/token',new URLSearchParams({grant_type:'client_credentials',client_id:c.key,client_secret:c.secret}).toString(),{...http,headers:{'Content-Type':'application/x-www-form-urlencoded'}});
   if(typeof data.access_token!=='string'||!Number.isFinite(Number(data.expires_in)))throw Error();
   tokenCache={identity,value:data.access_token,until:Date.now()+Math.min(3600,Number(data.expires_in))*1000};return tokenCache.value;
  } catch(_){throw Error('FedEx authentication is unavailable. Please try again later.');}
  finally{tokenPending=null;}
 })();tokenPending={identity,promise};return promise;
}
function virtual(data){return [...(data?.output?.alerts||[]),...(data?.alerts||[])].some(x=>x.code==='VIRTUAL.RESPONSE');}
async function post(path,body,c=config()) {
 const token=await accessToken(c);
 try {
  const {data}=await axios.post(c.base+path,body,{...http,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','X-locale':'en_US'}});
  if(c.environment==='production'&&virtual(data))throw Error('virtual');
  return data;
 }catch(e){
  if(e.response?.status===401)tokenCache=null;
  // Never expose axios request objects, authorization headers, account numbers or raw carrier errors.
  throw Error('FedEx could not calculate this shipment. Check the address or contact us.');
 }
}
function recipientAddress(a,residential){return {streetLines:[a.line1,a.line2].filter(Boolean),city:a.city,stateOrProvinceCode:a.state,postalCode:a.postal_code,countryCode:'US',residential};}
function shipDate(){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+1);
 while([0,6].includes(date.getUTCDay()))date.setUTCDate(date.getUTCDate()+1);
 return date.toISOString().slice(0,10);
}
function ratePayload(request,c=config()) {
 return {accountNumber:{value:c.account},rateRequestControlParameters:{returnTransitTimes:true},requestedShipment:{
  shipper:{address:request.origin},recipient:{address:recipientAddress(request.address,request.addressType==='residential')},
  pickupType:request.pickupType,rateRequestType:['ACCOUNT'],packagingType:'YOUR_PACKAGING',preferredCurrency:'USD',
  shipDateStamp:request.shipDate,totalPackageCount:request.packages.length,
  requestedPackageLineItems:request.packages.map((p,i)=>({sequenceNumber:i+1,groupPackageCount:1,
   weight:p.weightKg!==undefined?{units:'KG',value:p.weightKg}:{units:'LB',value:p.weightLb},
   dimensions:p.weightKg!==undefined?{length:p.lengthCm,width:p.widthCm,height:p.heightCm,units:'CM'}:{length:p.lengthIn,width:p.widthIn,height:p.heightIn,units:'IN'},
   declaredValue:{amount:p.unitPriceCents/100,currency:'USD'}}))}};
}
function parseRates(data,environment) {
 if(environment==='production'&&virtual(data))throw Error('Test FedEx rates cannot be used for checkout');
 const rates=[];
 for(const rate of data?.output?.rateReplyDetails||[]) {
  if(!SERVICES.has(rate.serviceType))continue;
  for(const detail of rate.ratedShipmentDetails||[]) {
   if(!String(detail.rateType||'').includes('ACCOUNT'))continue;
   const currency=detail.currency||detail.shipmentRateDetail?.currency;
   const amount=Number(detail.totalNetChargeWithDutiesAndTaxes??detail.totalNetCharge);
   const cents=Math.round(amount*100);
   if(currency!=='USD'||!Number.isFinite(amount)||!Number.isSafeInteger(cents)||cents<=0||cents>10000000)continue;
   rates.push({serviceType:rate.serviceType,carrier:'FedEx',serviceName:rate.serviceName||rate.serviceType.replace(/_/g,' '),
    amountCents:cents,currency:'USD',deliveryDate:rate.commit?.dateDetail?.dayFormat||null,
    transitTime:rate.commit?.transitDays?.description||rate.commit?.deliveryMessages?.[0]||null});
  }
 }
 rates.sort((a,b)=>a.amountCents-b.amountCents||a.serviceType.localeCompare(b.serviceType));
 if(!rates.length)throw Error('No FedEx parcel rates are available for this address. Contact us or choose self-pickup.');
 return {selected:rates[0],rates,virtual:virtual(data),transactionId:data.transactionId||null};
}
function parseAddressValidation(data,request) {
 const resolved=data.output?.resolvedAddresses?.[0],attrs=resolved?.attributes;
 const isTrue=v=>v===true||v==='true';
 if(isTrue(attrs?.POBox)||isTrue(attrs?.POBoxOnlyZIP))throw Error('FedEx requires a street address, not a PO Box');
 if(isTrue(attrs?.InvalidSuiteNumber))throw Error('Check the apartment, suite or unit number and calculate shipping again.');
 const suiteMissing=isTrue(attrs?.SuiteRequiredButMissing);
 const interpolated=isTrue(attrs?.InterpolatedAddress)||(resolved?.customerMessages||[]).some(x=>x.code==='INTERPOLATED.STREET.ADDRESS');
 const dpv=isTrue(attrs?.DPV);
 // FedEx can omit attributes.DPV for an exact standardized postal match.
 // Its documentation says to inspect the other attributes in that case, rather
 // than treating an omitted flag as false. Keep explicit DPV failures rejected.
 const postalMatch=attrs?.DPV==null&&isTrue(attrs?.Matched)&&attrs?.AddressType==='STANDARDIZED'&&
  isTrue(attrs?.StreetAddress)&&isTrue(attrs?.ZIP11Match)&&/^\d{2}$/.test(resolved?.parsedPostalCode?.deliveryPoint||'');
 // USPS can match the building exactly but not a unit. This is useful for
 // rating, not proof of unit-level delivery: preserve it as a visible warning.
 const buildingMatch=suiteMissing&&isTrue(attrs?.MultiUnitBase)&&isTrue(attrs?.Matched)&&
  attrs?.AddressType==='STANDARDIZED'&&isTrue(attrs?.ZIP4Match);
 if(!resolved||!isTrue(attrs?.Resolved)||(!dpv&&!postalMatch&&!buildingMatch)||interpolated||isTrue(attrs?.MultipleMatches))
  throw Error('FedEx could not verify the delivery address. Check the street, apartment, city and ZIP.');
 const classification=['BUSINESS','RESIDENTIAL','MIXED'].includes(resolved.classification)?resolved.classification:'UNKNOWN';
 const lines=Array.isArray(resolved.streetLinesToken)?resolved.streetLinesToken.filter(x=>typeof x==='string'&&x.trim()).slice(0,3):[];
 const suggestedAddress=lines.length&&resolved.city&&resolved.stateOrProvinceCode&&/^\d{5}(?:-\d{4})?$/.test(resolved.postalCode||'')&&resolved.countryCode==='US'
  ?{line1:lines[0].slice(0,200),line2:(request.address.line2||lines.slice(1).join(' ')).slice(0,200),city:String(resolved.city).slice(0,100),state:resolved.stateOrProvinceCode,postal_code:resolved.postalCode.slice(0,5),country:'US'}:null;
 // Do not silently replace the buyer's address with a materially different correction.
 if(String(resolved.postalCode||'').slice(0,5)!==request.address.postal_code.slice(0,5)||resolved.stateOrProvinceCode!==request.address.state||resolved.countryCode!=='US')
  throw Object.assign(Error('FedEx found a different ZIP or state. Please review the suggested address below.'),{addressSuggestion:suggestedAddress});
 return {classification,addressType:classification==='BUSINESS'?'business':'residential',
  classificationMethod:['BUSINESS','RESIDENTIAL'].includes(classification)?'fedex':'residential_fallback',
  validated:!suiteMissing,method:buildingMatch?'standardized_building_match':dpv?'dpv':'standardized_postal_match',dpv:dpv?true:attrs?.DPV==null?null:false,
  suggestedAddress,warnings:suiteMissing?[{code:'UNIT_MAY_BE_REQUIRED',message:'FedEx found your building. If your address has an apartment, suite or unit number, add it above and recalculate. If it has no unit number, you can continue with this address.'}]:[]};
}
async function validateAddress(request,c) {
 // Classification belongs to FedEx; do not bias it with a customer-selected flag.
 const data=await post('/address/v1/addresses/resolve',{addressesToValidate:[{address:recipientAddress(request.address)}]},c);
 return parseAddressValidation(data,request);
}
async function calculate(request) {
 const c=config();
 if(!/^\d{9}$/.test(c.account||''))throw Error('A FedEx shipping account number is required');
 const validation=await validateAddress(request,c);
 const result=parseRates(await post('/rate/v1/rates/quotes',ratePayload({...request,addressType:validation.addressType},c),c),c.environment);
 return {...result,validation};
}
module.exports={config,enabled,accessToken,ratePayload,parseRates,parseAddressValidation,calculate,shipDate,virtual};
