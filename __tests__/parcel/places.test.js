jest.mock('axios',()=>jest.fn());
jest.mock('../../integrations/freight/addresses',()=>({lookupZip:jest.fn().mockResolvedValue({zip:'33314',places:[{latitude:26.07,longitude:-80.2}]})}));
const {randomUUID}=require('crypto');
let service,axios;
const components=(overrides={})=>Object.entries({street_number:'4850',route:'SW 52nd St',locality:'Davie',administrative_area_level_1:'FL',country:'US',postal_code:'33314',...overrides}).filter(([,v])=>v!==null).map(([type,value])=>({types:[type],longText:value,shortText:value}));
const prediction={data:{suggestions:[{placePrediction:{placeId:'place_123',structuredFormat:{mainText:{text:'4850 Southwest 52nd Street'},secondaryText:{text:'Davie, FL, USA'}}}}]}};
const input=()=>({zip:'33314',input:'4850 SW',sessionToken:randomUUID()});
beforeEach(()=>{jest.resetModules();process.env.GOOGLE_PLACES_API_KEY='test-key';axios=require('axios');service=require('../../integrations/parcel/places');});
afterEach(()=>{delete process.env.GOOGLE_PLACES_API_KEY;jest.useRealTimers()});
test('US suggestions use ZIP bias and a user-scoped billing session; details request only address fields',async()=>{
 axios.mockResolvedValueOnce(prediction).mockResolvedValueOnce({data:{addressComponents:components()}});
 const q=input(),result=await service.autocomplete(7,q);expect(result.suggestions[0].mainText).toContain('4850');
 const first=axios.mock.calls[0][0];expect(first.data).toMatchObject({includedRegionCodes:['us'],locationBias:{circle:{center:{latitude:26.07,longitude:-80.2}}}});expect(first.data.sessionToken).not.toBe(q.sessionToken);
 const details=await service.details(7,{...q,placeId:'place_123'});expect(details).toMatchObject({missingStreetNumber:false,address:{line1:'4850 SW 52nd St',city:'Davie',postal_code:'33314',country:'US'}});
 expect(axios.mock.calls[1][0]).toMatchObject({method:'GET',params:{sessionToken:first.data.sessionToken},headers:{'X-Goog-FieldMask':'addressComponents'}});
 await expect(service.details(7,{...q,placeId:'place_123'})).rejects.toThrow('expired');expect(axios).toHaveBeenCalledTimes(2);
});
test('another user, ZIP or unsuggested place cannot consume a session',async()=>{
 axios.mockResolvedValue(prediction);const q=input();await service.autocomplete(7,q);
 for(const [userId,extra] of [[8,{}],[7,{zip:'10001'}],[7,{placeId:'other'}]])await expect(service.details(userId,{...q,placeId:'place_123',...extra})).rejects.toThrow('expired');
 expect(axios).toHaveBeenCalledTimes(1);
});
test('changing ZIP needs a fresh session; an expired session cannot resolve details',async()=>{
 axios.mockResolvedValue(prediction);const q=input();await service.autocomplete(7,q);
 await expect(service.autocomplete(7,{...q,zip:'10001'})).rejects.toThrow('new address search');
 jest.useFakeTimers().setSystemTime(Date.now()+600001);await expect(service.details(7,{...q,placeId:'place_123'})).rejects.toThrow('expired');
});
test.each([{zip:'bad'},{zip:33314},{input:'ab'},{input:'x'.repeat(201)},{sessionToken:'bad'}])('rejects malformed requests before paid API call: %j',async change=>{
 await expect(service.autocomplete(7,{...input(),...change})).rejects.toThrow();expect(axios).not.toHaveBeenCalled();
});
test('configuration and provider errors preserve manual entry and hide secrets',async()=>{
 delete process.env.GOOGLE_PLACES_API_KEY;expect(service.enabled()).toBe(false);
 await expect(service.autocomplete(7,input())).rejects.toThrow('manually');expect(axios).not.toHaveBeenCalled();
 process.env.GOOGLE_PLACES_API_KEY='private-key';axios.mockRejectedValue({message:'private-key',config:{headers:{'X-Goog-Api-Key':'private-key'}}});
 await expect(service.autocomplete(7,input())).rejects.toThrow('unavailable');
});
test('per-user rate limit bounds paid calls',async()=>{
 axios.mockResolvedValue(prediction);const q=input();for(let i=0;i<120;i++)await service.autocomplete(7,q);
 await expect(service.autocomplete(7,q)).rejects.toMatchObject({status:429});expect(axios).toHaveBeenCalledTimes(120);
});
test('ZIP correction is returned explicitly, not forced to original ZIP',()=>{
 expect(service.parseAddress({addressComponents:components({postal_code:'10118',administrative_area_level_1:'NY',locality:'New York'})}).address.postal_code).toBe('10118');
});
test('street-only suggestions flag missing building number; units and supported city fallbacks are retained',()=>{
 const result=service.parseAddress({addressComponents:components({street_number:null,subpremise:'5',locality:null,postal_town:'Davie'})});
 expect(result).toMatchObject({missingStreetNumber:true,address:{line1:'SW 52nd St',line2:'Unit 5',city:'Davie'}});
});
test.each([{country:'CA'},{route:null},{locality:null},{postal_code:null},{administrative_area_level_1:'PR'}])('does not invent missing delivery fields: %j',overrides=>{
 expect(()=>service.parseAddress({addressComponents:components(overrides)})).toThrow('manually');
});
test('parallel detail requests cannot terminate a session twice',async()=>{
 axios.mockResolvedValueOnce(prediction);const q=input();await service.autocomplete(7,q);
 let finish;axios.mockImplementationOnce(()=>new Promise(resolve=>finish=resolve));const one=service.details(7,{...q,placeId:'place_123'});
 await expect(service.details(7,{...q,placeId:'place_123'})).rejects.toThrow('expired');finish({data:{addressComponents:components()}});await one;expect(axios).toHaveBeenCalledTimes(2);
});
