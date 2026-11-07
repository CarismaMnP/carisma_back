const {productPackage,validatePackage,DEFAULT_PACKAGE}=require('../../integrations/parcel/packages');
const {definitions}=require('../../integrations/parcel/profiles');
const {productProfile}=require('../../integrations/freight/profiles');
const {ratePayload}=require('../../integrations/parcel/fedex');
const part=(code,extra={})=>({source:'carparts',carpartsPartCode:code,...extra});
test('all configured imperial packages pass carrier size and weight limits',()=>{
 for(const [codes,,lengthIn,widthIn,heightIn,weightLb] of definitions){
  for(const code of codes.split(' ')){
   const expected={lengthIn,widthIn,heightIn,weightLb};
   expect(productPackage(part(code))).toEqual(expected);
   expect(validatePackage(expected)).toEqual(expected);
   expect(productProfile(part(code))).toBeNull();
  }
 }
});
test.each([['COW',48,15,10,45],['HSH',14,12,10,5],['RMD',85,10,10,10],['RPN',85,10,10,10],['INF',30,25,16,10],['IFL',22,22,16,10],['FDW',41,25,6,15],['RDW',35,25,6,15],['MTP',24,10,10,25],['STG',48,10,10,30],['WEB',16,14,10,18],['XAF',22,22,10,60]])('verified category %s reaches FedEx in IN/LB',(code,l,w,h,lb)=>{
 const payload=ratePayload({address:{line1:'1 Test St',city:'Davie',state:'FL',postal_code:'33314'},addressType:'residential',origin:{postalCode:'32209'},packages:[{...productPackage(part(code)),unitPriceCents:10000}]});
 expect(payload.requestedShipment.requestedPackageLineItems[0]).toMatchObject({weight:{units:'LB',value:lb},dimensions:{units:'IN',length:l,width:w,height:h}});
});
test('specific source codes beat misleading imported categories and title words',()=>{
 expect(productPackage(part('RSP',{ebayCategory:'Radiators'}))).toMatchObject({lengthIn:48,weightLb:20});
 for(const code of ['STM','BLS','HSS','BGG','SWC','SPH','JKK','TMO'])expect(productPackage(part(code,{ebayCategory:'Wheel',name:'Wheel seat headlamp assembly'}))).toEqual(DEFAULT_PACKAGE);
 expect(productPackage({source:'carparts',carpartsData:{part:' grl '}})).toMatchObject({lengthIn:30,weightLb:15});
});
test('manual exact categories work without guessing at generic groups or overriding explicit measurements',()=>{
 expect(productPackage({source:'manual',ebayCategory:'Rocker molding'})).toMatchObject({lengthIn:85});
 expect(productPackage({source:'manual',ebayCategory:'Auto Glass'})).toEqual(DEFAULT_PACKAGE);
 expect(productPackage(part('GRL',{parcelPackage:{lengthIn:9,widthIn:8,heightIn:7,weightLb:3}}))).toEqual({lengthIn:9,widthIn:8,heightIn:7,weightLb:3});
 expect(productPackage(part('GRL',{parcelPackage:{weightLb:999}}))).toBeNull();
});
