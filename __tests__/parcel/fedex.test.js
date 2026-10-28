jest.mock('axios');
const axios=require('axios');
const provider=require('../../integrations/parcel/fedex');
const {validatePackage}=require('../../integrations/parcel/packages');
const reply=(currency='USD',amount=25.53)=>({output:{rateReplyDetails:[{serviceType:'FEDEX_GROUND',serviceName:'FedEx Ground',ratedShipmentDetails:[{rateType:'ACCOUNT',currency,totalNetCharge:amount}]}]}});
const request={address:{line1:'1 Main St',city:'Winter Garden',state:'FL',postal_code:'34787'},addressType:'residential',origin:{postalCode:'32209'},packages:[{weightLb:10,lengthIn:20,widthIn:12,heightIn:8,unitPriceCents:25000}],shipDate:'2026-10-30',pickupType:'DROPOFF_AT_FEDEX_LOCATION'};
beforeEach(()=>{process.env.FEDEX_ENVIRONMENT='sandbox';process.env.FEDEX_CHECKOUT_ENABLED='true';process.env.FEDEX_API_KEY='unit-key';process.env.FEDEX_SECRET_KEY='unit-secret';process.env.FEDEX_ACCOUNT_NUMBER='000000000';jest.clearAllMocks()});
test('sandbox is never enabled for buyer checkout',()=>{expect(provider.enabled()).toBe(false);process.env.FEDEX_ENVIRONMENT='production';expect(provider.enabled()).toBe(true);delete process.env.FEDEX_ACCOUNT_NUMBER;expect(provider.enabled()).toBe(false)});
test('package validation rounds dimensions up and rejects missing or oversize data',()=>{
 expect(validatePackage({weightLb:2.333,lengthIn:10.1,widthIn:9,heightIn:8})).toEqual({weightLb:2.34,lengthIn:11,widthIn:9,heightIn:8});
 for(const value of [null,{}, {weightLb:151,lengthIn:10,widthIn:10,heightIn:10},{weightLb:10,lengthIn:100,widthIn:30,heightIn:30},{weightLb:'junk',lengthIn:10,widthIn:10,heightIn:10}])expect(()=>validatePackage(value)).toThrow();
});
test('payload includes real address, each package and declared value',()=>{const body=provider.ratePayload(request);expect(body.accountNumber.value).toBe('000000000');expect(body.requestedShipment.recipient.address.residential).toBe(true);expect(body.requestedShipment.requestedPackageLineItems[0]).toMatchObject({weight:{units:'LB',value:10},declaredValue:{amount:250,currency:'USD'},dimensions:{units:'IN',length:20}})});
test('selects cheapest usable account rate, including surcharges, without economy or freight',()=>{
 const data=reply();data.output.rateReplyDetails.push({serviceType:'FEDEX_2_DAY',ratedShipmentDetails:[{rateType:'ACCOUNT',currency:'USD',totalNetCharge:50}]},{serviceType:'FEDEX_GROUND_ECONOMY',ratedShipmentDetails:[{rateType:'ACCOUNT',currency:'USD',totalNetCharge:1}]});
 expect(provider.parseRates(data,'production').selected.amountCents).toBe(2553);
});
test.each([reply('EUR'),reply('USD',0),reply('USD',-5),reply('USD',null),{}])('rejects missing, non-USD and invalid rates',data=>expect(()=>provider.parseRates(data,'production')).toThrow());
test('virtual responses cannot enter production payment',()=>{const data=reply();data.output.alerts=[{code:'VIRTUAL.RESPONSE'}];expect(()=>provider.parseRates(data,'production')).toThrow('Test FedEx');expect(provider.parseRates(data,'sandbox').virtual).toBe(true)});
test('oauth requests share a cached token and do not leak credentials on failure',async()=>{
 axios.post.mockResolvedValueOnce({data:{access_token:'unit-token',expires_in:3600}});
 const [a,b]=await Promise.all([provider.accessToken(),provider.accessToken()]);expect(a).toBe(b);expect(axios.post).toHaveBeenCalledTimes(1);
 axios.post.mockRejectedValueOnce({response:{data:{message:'secret'}}});await expect(provider.accessToken({...provider.config(),key:'different'})).rejects.toThrow('authentication is unavailable');
});
test('ship date is a future weekday in the origin timezone',()=>{const date=new Date(provider.shipDate()+'T12:00:00Z');expect([0,6]).not.toContain(date.getUTCDay());expect(date.getTime()).toBeGreaterThan(Date.now()-86400000)});
