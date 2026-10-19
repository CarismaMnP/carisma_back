const axios=require('axios');
const {FreightQuote}=require('../../models/models');
const cache=new Map(),pending=new Map();
const fail=(status,message)=>Object.assign(new Error(message),{status});
function zipCode(value){if(!/^\d{5}$/.test(value||''))throw fail(400,'Enter a valid US ZIP code');return value;}
async function lookupZip(value){
  const zip=zipCode(value),cached=cache.get(zip);
  if(cached&&cached.until>Date.now())return cached.value;
  if(pending.has(zip))return pending.get(zip);
  const work=(async()=>{
    try{
      const {data}=await axios.get(`https://api.zippopotam.us/us/${zip}`,{timeout:5000,maxRedirects:0,maxContentLength:150000});
      if(data['country abbreviation']!=='US'||String(data['post code'])!==zip||!Array.isArray(data.places))throw Error('Invalid ZIP response');
      const places=data.places.map(x=>({city:x['place name'],state:x['state abbreviation'],stateName:x.state,latitude:Number(x.latitude),longitude:Number(x.longitude)}))
        .filter(x=>typeof x.city==='string'&&/^[A-Z]{2}$/.test(x.state)&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude));
      if(!places.length)throw Error('ZIP not found');
      const result={zip,places};
      if(cache.size>=5000)cache.delete(cache.keys().next().value);
      cache.set(zip,{value:result,until:Date.now()+86400000});return result;
    }catch(_){return {zip,places:[]};}
    finally{pending.delete(zip);}
  })();
  pending.set(zip,work);return work;
}
async function context(userId,quoteId){
  if(!/^[0-9a-f-]{36}$/i.test(quoteId||''))throw fail(400,'Calculate freight shipping first');
  const q=await FreightQuote.findOne({where:{id:quoteId,userId,status:'quoted'}});
  if(!q||Date.parse(q.expiresAt)<=Date.now())throw fail(409,'Calculate freight shipping again before entering an address');
  const location=await lookupZip(q.request.zip);
  return location;
}
module.exports={lookupZip,context};
