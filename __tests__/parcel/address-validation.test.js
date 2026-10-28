jest.mock('axios');
const axios=require('axios');
const provider=require('../../integrations/parcel/fedex');
const address={line1:'10 Example Trail',line2:'',city:'Winter Garden',state:'FL',postal_code:'34787',country:'US'};
const request={address,addressType:'residential',origin:{postalCode:'32209'},packages:[{weightKg:7,lengthCm:40,widthCm:30,heightCm:20,unitPriceCents:4509}],shipDate:'2026-10-30',pickupType:'DROPOFF_AT_FEDEX_LOCATION'};
// Same response shape as the live regression; no customer's street address is stored here.
function response(){return {output:{resolvedAddresses:[{streetLinesToken:['10 EXAMPLE TRL'],city:'WINTER GARDEN',stateOrProvinceCode:'FL',countryCode:'US',postalCode:'34787-1234',classification:'RESIDENTIAL',normalizedStatusNameDPV:false,customerMessages:[],parsedPostalCode:{base:'34787',addOn:'1234',deliveryPoint:'10'},attributes:{Resolved:'true',Matched:'true',AddressType:'STANDARDIZED',StreetAddress:'true',ZIP11Match:'true',ZIP4Match:'true',SuiteRequiredButMissing:'false',InvalidSuiteNumber:'false'}}]}};}
const resolved=data=>data.output.resolvedAddresses[0];
test('accepts exact standardized postal match when FedEx omits attributes.DPV',()=>{
 const data=response();expect(resolved(data).attributes).not.toHaveProperty('DPV');
 expect(provider.parseAddressValidation(data,request)).toEqual({classification:'RESIDENTIAL',validated:true,method:'standardized_postal_match',dpv:null});
 expect(request.address).toEqual(address);
});
test.each([true,'true'])('keeps explicitly DPV-verified addresses working: %s',value=>{
 const data=response();resolved(data).attributes={Resolved:value,DPV:value};
 expect(provider.parseAddressValidation(data,request)).toMatchObject({validated:true,method:'dpv',dpv:true});
});
test.each([false,'false',''])('does not turn explicit invalid/empty DPV into a postal fallback: %s',value=>{
 const data=response();resolved(data).attributes.DPV=value;expect(()=>provider.parseAddressValidation(data,request)).toThrow('could not verify');
});
test.each(['Resolved','Matched','AddressType','StreetAddress','ZIP11Match'])('omitted DPV needs a complete postal match: %s',key=>{
 const data=response();delete resolved(data).attributes[key];expect(()=>provider.parseAddressValidation(data,request)).toThrow('could not verify');
});
test.each(['InterpolatedAddress','MultipleMatches'])('rejects ambiguous or interpolated matches: %s',key=>{
 const data=response();resolved(data).attributes[key]='true';expect(()=>provider.parseAddressValidation(data,request)).toThrow('could not verify');
});
test('rejects an interpolated-address warning even without an attribute flag',()=>{
 const data=response();resolved(data).customerMessages=[{code:'INTERPOLATED.STREET.ADDRESS'}];expect(()=>provider.parseAddressValidation(data,request)).toThrow('could not verify');
});
test('requires a full delivery point for the postal fallback',()=>{
 const data=response();delete resolved(data).parsedPostalCode;expect(()=>provider.parseAddressValidation(data,request)).toThrow('could not verify');
});
test.each([['SuiteRequiredButMissing','Add the apartment'],['InvalidSuiteNumber','Check the apartment'],['POBox','street address'],['POBoxOnlyZIP','street address']])('reports actionable address issues: %s',(key,error)=>{
 const data=response();resolved(data).attributes[key]='true';expect(()=>provider.parseAddressValidation(data,request)).toThrow(error);
});
test.each([['postalCode','10001'],['stateOrProvinceCode','NY'],['countryCode','CA']])('never silently changes the delivery region: %s',(key,value)=>{
 const data=response();resolved(data)[key]=value;expect(()=>provider.parseAddressValidation(data,request)).toThrow('different ZIP or state');
});
test('still prevents quoting a residential address as business',()=>{
 expect(()=>provider.parseAddressValidation(response(),{...request,addressType:'business'})).toThrow('Select Residential');
});
test.each([{}, {output:{resolvedAddresses:[]}}, {output:{resolvedAddresses:[{}]}}])('rejects missing or unresolved address results',data=>{
 expect(()=>provider.parseAddressValidation(data,request)).toThrow('could not verify');
});
test('missing DPV with a postal match reaches the rate API and keeps the entered address',async()=>{
 Object.assign(process.env,{FEDEX_ENVIRONMENT:'production',FEDEX_API_KEY:'unit-key',FEDEX_SECRET_KEY:'unit-secret',FEDEX_ACCOUNT_NUMBER:'000000000'});
 axios.post.mockImplementation(async(url)=>{
  if(url.endsWith('/oauth/token'))return {data:{access_token:'unit-token',expires_in:3600}};
  if(url.endsWith('/addresses/resolve'))return {data:response()};
  if(url.endsWith('/rates/quotes'))return {data:{output:{rateReplyDetails:[{serviceType:'GROUND_HOME_DELIVERY',ratedShipmentDetails:[{rateType:'ACCOUNT',currency:'USD',totalNetCharge:35}]}]}}};
  throw Error('Unexpected provider endpoint');
 });
 const result=await provider.calculate(request);
 expect(result.selected.amountCents).toBe(3500);expect(result.validation.method).toBe('standardized_postal_match');
 const rateCall=axios.post.mock.calls.find(([url])=>url.endsWith('/rates/quotes'));
 expect(rateCall[1].requestedShipment.recipient.address).toMatchObject({streetLines:[address.line1],postalCode:'34787',residential:true});
 expect(rateCall[1].requestedShipment.requestedPackageLineItems[0]).toMatchObject({weight:{units:'KG',value:7},dimensions:{units:'CM',length:40,width:30,height:20}});
});
