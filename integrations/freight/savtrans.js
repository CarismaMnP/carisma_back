const axios = require('axios');
const BASE = 'https://vsa.savtrans.com';
function money(value) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(value))) throw Error('Invalid broker amount');
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents < 0) throw Error('Invalid broker amount');
  return cents;
}
function quoteUrl(value) {
  const url = new URL(value, BASE);
  if (url.origin !== BASE || url.username || url.password || url.search || url.hash ||
    !/^\/api\.php\/rest\/rate_request\/[a-f0-9]+\.json$/.test(url.pathname)) throw Error('Invalid broker quote reference');
  return url;
}
function requestBody(request) {
  const form = new URLSearchParams({pickup_postal: request.originZip, delivery_postal: request.zip,
    insured_value: (request.insuredCents / 100).toFixed(2)});
  for (const id of request.accessorials) form.append('add_charges[]', String(id));
  request.shipmentItems.forEach((item,i) => {
    const fields = {weight:item.weight,pallets:1,pieces:1,class:item.freightClass,length:item.length,
      width:item.width,height:item.height,is_hazmat:0,description:item.commodity,nmfc:item.nmfc};
    for (const [key,value] of Object.entries(fields)) form.append(`items[${i}][${key}]`,String(value));
  });
  return form;
}
function normalizeResult(data, request, referenceUrl) {
  if (!data || data.is_complete || data.bol_num || data.pickup_postal !== request.originZip ||
    data.delivery_postal !== request.zip || money(data.insured_value) !== request.insuredCents ||
    !Array.isArray(data.items) || data.items.length !== request.shipmentItems.length ||
    !Array.isArray(data.contract_charge_types) ||
    data.contract_charge_types.map(x=>Number(x.id)).sort((a,b)=>a-b).join(',') !== [...request.accessorials].sort((a,b)=>a-b).join(','))
    throw Error('Broker returned different shipment details');
  data.items.forEach((actual,i) => {
    const expected = request.shipmentItems[i];
    for (const key of ['weight','length','width','height','pallets','pieces'])
      if (Number(actual[key]) !== Number(expected[key])) throw Error('Broker returned different package dimensions');
    if (Number(actual.class) !== expected.freightClass || actual.nmfc !== expected.nmfc || actual.is_hazmat)
      throw Error('Broker returned different commodity classification');
  });
  const insuranceCents = money(data.insured_charge);
  if (insuranceCents <= 0) throw Error('Broker did not include insurance');
  const rates = (data.rate_results || []).filter(r => !r.is_dispatched && r.contract?.carrier?.name && r.contract?.hash)
    .map(r => ({amountCents:money(r.total_charge),carrier:r.contract.carrier.name.replace(/&amp;/g,'&'),
      carrierCode:r.contract.carrier.code,contractHash:r.contract.hash,
      transitDays:r.transit_time == null ? null : Number(r.transit_time),transitDaysMax:r.transit_time_max == null ? null : Number(r.transit_time_max)}))
    .filter(r => r.amountCents > insuranceCents).sort((a,b)=>a.amountCents-b.amountCents || a.carrier.localeCompare(b.carrier));
  if (!rates.length) throw Error('No freight rates are available for this destination');
  // total_charge already includes alternative insurance. Do not add it again.
  return {reference: quoteUrl(referenceUrl).pathname.split('/').pop().replace('.json',''),
    insuranceCents,rates,selected:rates[0]};
}
async function calculate(request) {
  if (process.env.FREIGHT_ENABLED !== 'true' || !process.env.SAVTRANS_USERNAME || !process.env.SAVTRANS_PASSWORD)
    throw Error('Freight quotes are temporarily unavailable. Please try again or choose pickup.');
  const options = {auth:{username:process.env.SAVTRANS_USERNAME,password:process.env.SAVTRANS_PASSWORD},
    maxRedirects:0,maxContentLength:2*1024*1024,timeout:45000,validateStatus:()=>true};
  try {
    const response = await axios.post(`${BASE}/api.php/rest/rate_request.json`,requestBody(request).toString(),
      {...options,headers:{'Content-Type':'application/x-www-form-urlencoded'}});
    if (response.status !== 201) throw Error('Broker could not calculate this shipment');
    const url = quoteUrl(response.headers.location);
    const result = await axios.get(url.href,{...options,timeout:15000});
    if (result.status !== 200) throw Error('Broker quote could not be retrieved');
    return normalizeResult(result.data,request,url.href);
  } catch(error) {
    // Axios errors contain credentials and request headers; never expose/log the raw error.
    if (error.isAxiosError) throw Error('The freight broker did not respond. Please try again shortly.');
    throw error;
  }
}
module.exports = {calculate, money, quoteUrl, requestBody, normalizeResult};
