jest.mock('../../integrations/freight/addresses',()=>({lookupZip:jest.fn(async()=>({places:[{city:'Winter Garden',state:'FL'}]}))}));
jest.mock('../../integrations/carparts/transport',()=>({bridge:jest.fn(()=>{throw Error('No live Checkmate writes in parcel tests')})}));
jest.mock('../../integrations/freight/savtrans',()=>({calculate:jest.fn(async()=>({selected:{carrier:'Freight',amountCents:25000}}))}));
jest.mock('../../integrations/parcel/fedex',()=>({enabled:jest.fn(()=>true),config:()=>({environment:'production',account:'000000000',pickupType:'DROPOFF_AT_FEDEX_LOCATION'}),shipDate:()=> '2026-10-30',calculate:jest.fn(async()=>({selected:{carrier:'FedEx',serviceName:'FedEx Ground',amountCents:2530},rates:[],virtual:false}))}));
const suite=process.env.CARPARTS_TEST_DB==='true'?describe:describe.skip;
suite('parcel checkout integrity',()=>{
 let sequelize,m,service,orders,small,big;
 const address={line1:'1 Main St',line2:'',city:'Winter Garden',state:'FL',postal_code:'34787',country:'US'};
 const input=()=>({products:[{productId:small.id,count:2}],zip:'34787',addressType:'residential',address});
 const data=()=>({userId:1,fullName:'Test User',mail:'test@example.invalid',phone:'9045550100',delivey_type:'ups',products:input().products,shippingAddress:address,addressType:'residential'});
 beforeAll(async()=>{if(!/^carisma_sync_test_/.test(process.env.DB_NAME||''))throw Error('Test database required');({sequelize}=require('../../db'));m=require('../../models/models');service=require('../../integrations/parcel/service');orders=require('../../integrations/carparts/orders');await sequelize.sync({force:true});await m.User.bulkCreate([{id:1,mail:'test@example.invalid'},{id:2,mail:'other@example.invalid'}])},30000);
 afterAll(async()=>{if(sequelize)await sequelize.close()});
 beforeEach(async()=>{
  await sequelize.query('TRUNCATE parcel_quotes, freight_quotes, carparts_jobs, "cartProducts", "orderProducts", orders, products RESTART IDENTITY CASCADE');
  small=await m.Product.create({name:'Small part',link:'small',images:[],price:50,count:5,source:'manual',parcelPackage:{weightLb:10,lengthIn:20,widthIn:10,heightIn:10}});
  big=await m.Product.create({name:'Door',link:'door',images:[],price:700,count:1,source:'manual',freightCategoryCode:'FDR'});
  require('../../integrations/parcel/fedex').enabled.mockReturnValue(true);require('../../integrations/parcel/fedex').calculate.mockClear();
 });
 test('quote is cached, logged and reserves no inventory',async()=>{const a=await service.createQuote(1,input()),b=await service.createQuote(1,input());expect(a.id).toBe(b.id);expect((await small.reload()).count).toBe(5);expect(await m.ParcelQuote.count()).toBe(1);expect((await m.ParcelQuote.findByPk(a.id)).request.packages).toHaveLength(2)});
 test('duplicate concurrent requests make at most one carrier call',async()=>{const result=await Promise.allSettled([service.createQuote(1,input()),service.createQuote(1,input())]);expect(result.some(x=>x.status==='fulfilled')).toBe(true);expect(require('../../integrations/parcel/fedex').calculate).toHaveBeenCalledTimes(1)});
 test('quote total and address survive reservation and release',async()=>{const q=await service.createQuote(1,input());const {order}=await orders.reserveOrder({...data(),parcelQuoteId:q.id,shippingAmount:0});expect(order.shippingExpectedCents).toBe(2530);expect(order.shippingAddress).toEqual(address);expect(order.sum).toBe(100);expect((await small.reload()).count).toBe(3);await orders.releaseReservation(order.id);expect((await small.reload()).count).toBe(5)});
 test.each(['owner','expiry','street','zip','price','quantity','package','environment','virtual','missing'])('rejects tampered/stale quote: %s',async change=>{
  const q=await service.createQuote(1,input()),d={...data(),parcelQuoteId:q.id};
  if(change==='owner')d.userId=2;
  if(change==='expiry')await m.ParcelQuote.update({expiresAt:new Date(0)},{where:{id:q.id}});
  if(change==='street')d.shippingAddress={...address,line1:'2 Main St'};
  if(change==='zip')d.shippingAddress={...address,postal_code:'10001'};
  if(change==='price')await small.update({price:51});
  if(change==='quantity')d.products=[{productId:small.id,count:1}];
  if(change==='package')await small.update({parcelPackage:{...small.parcelPackage,weightLb:20}});
  if(change==='environment')await m.ParcelQuote.update({environment:'sandbox'},{where:{id:q.id}});
  if(change==='virtual')await m.ParcelQuote.update({result:{virtual:true}},{where:{id:q.id}});
  if(change==='missing')delete d.parcelQuoteId;
  await expect(orders.reserveOrder(d)).rejects.toThrow();expect(await m.Order.count()).toBe(0);expect((await small.reload()).count).toBe(5);
 });
 test('new quotes work without a building type and cannot be discounted by a client flag',async()=>{
  const {addressType,...automatic}=input();const q=await service.createQuote(1,automatic);
  const {order}=await orders.reserveOrder({...data(),addressType:'business',parcelQuoteId:q.id});
  expect(order.shippingExpectedCents).toBe(2530);expect(order.parcelSnapshot.request).toMatchObject({version:2,addressType:'automatic'});
 });
 test('existing version 1 quotes remain bound to their original type during deployment',async()=>{
  const {rows,products}=await require('../../integrations/freight/service').loadBasket(input().products);
  const request=service.buildRequest(rows,products,input(),1);
  const q=await m.ParcelQuote.create({userId:1,status:'quoted',environment:'production',request,fingerprint:require('../../integrations/freight/service').fingerprint(request),amountCents:2530,expiresAt:new Date(Date.now()+600000),result:{selected:{serviceName:'FedEx'},virtual:false}});
  await expect(orders.reserveOrder({...data(),parcelQuoteId:q.id,addressType:'business'})).rejects.toThrow('changed');
  const d={...data(),parcelQuoteId:q.id};delete d.addressType;
  expect((await orders.reserveOrder(d)).order.shippingExpectedCents).toBe(2530);
 });
 test('building warnings and normalized suggestions are saved and exposed without package internals',async()=>{
  const validation={classification:'MIXED',addressType:'residential',validated:false,method:'standardized_building_match',suggestedAddress:{...address,city:'POSTAL CITY'},warnings:[{code:'UNIT_MAY_BE_REQUIRED',message:'Add a unit if your address has one.'}]};
  require('../../integrations/parcel/fedex').calculate.mockResolvedValueOnce({selected:{serviceName:'FedEx Home Delivery',amountCents:2530},virtual:false,validation});
  const q=await service.createQuote(1,input());expect(q.addressWarnings).toEqual(validation.warnings);expect(q.addressSuggestion.city).toBe('POSTAL CITY');expect(JSON.stringify(q)).not.toMatch(/weightLb|lengthIn/);
  const {order}=await orders.reserveOrder({...data(),parcelQuoteId:q.id});expect(order.parcelSnapshot.result.validation).toEqual(validation);expect(order.shippingAddress).toEqual(address);
 });
 test('address corrections are returned to the customer and logged with a failed quote',async()=>{
  const suggestion={...address,postal_code:'10001',state:'NY',city:'NEW YORK'};
  require('../../integrations/parcel/fedex').calculate.mockRejectedValueOnce(Object.assign(Error('Review the suggested address'),{addressSuggestion:suggestion}));
  process.env.SECRET_KEY='parcel-address-tests';const token=require('jsonwebtoken').sign({id:1,role:'USER'},process.env.SECRET_KEY);
  const r=await require('supertest')(require('../../utils/server')()).post('/api/public/order/parcel-quote').set('Authorization','Bearer '+token).send(input());
  expect(r.status).toBe(400);expect(r.body.addressSuggestion).toEqual(suggestion);expect((await m.ParcelQuote.findOne()).result.addressSuggestion).toEqual(suggestion);
 });
 test('invalid explicit package or unavailable carrier cannot become free shipping',async()=>{
  await small.update({parcelPackage:{weightLb:151,lengthIn:10,widthIn:10,heightIn:10}});await expect(service.createQuote(1,input())).rejects.toThrow('measurements');
  await small.update({parcelPackage:{weightLb:10,lengthIn:20,widthIn:10,heightIn:10}});
  require('../../integrations/parcel/fedex').calculate.mockRejectedValueOnce(Error('Carrier unavailable'));
  await expect(service.createQuote(1,input())).rejects.toThrow('Carrier unavailable');expect((await m.ParcelQuote.findOne()).status).toBe('failed');
 });
 test('mixed basket charges both carriers and excludes large parts from parcels',async()=>{
  await small.update({parcelPackage:null});
  const products=[...input().products,{productId:big.id,count:1}],dest={zip:'34787',addressType:'residential',limitedAccess:false};
  const fq=await require('../../integrations/freight/service').createQuote(1,{...dest,products});const pq=await service.createQuote(1,{...input(),products});
  const packages=(await m.ParcelQuote.findByPk(pq.id)).request.packages;
  expect(packages).toHaveLength(2);
  expect(packages.every(p=>p.productId===small.id&&p.weightKg===7&&p.lengthCm===40&&p.widthCm===30&&p.heightCm===20)).toBe(true);
  expect(JSON.stringify(pq)).not.toMatch(/weightKg|lengthCm|widthCm|heightCm/);
  const {order}=await orders.reserveOrder({...data(),products,delivey_type:'freight',freightDestination:dest,freightAddress:address,freightQuoteId:fq.id,parcelQuoteId:pq.id});
  expect(order.shippingExpectedCents).toBe(27530);expect(order.freightQuoteId).toBe(fq.id);expect(order.parcelQuoteId).toBe(pq.id);
 });
 test('default package quote must be recalculated after an explicit package override',async()=>{
  await small.update({parcelPackage:null});const q=await service.createQuote(1,input());
  await small.update({parcelPackage:{weightLb:5,lengthIn:10,widthIn:8,heightIn:6}});
  await expect(orders.reserveOrder({...data(),parcelQuoteId:q.id})).rejects.toThrow('measurements');
  expect(await m.Order.count()).toBe(0);expect((await small.reload()).count).toBe(5);
 });
 test('freight-only orders still use the broker without calling FedEx',async()=>{
  const products=[{productId:big.id,count:1}],dest={zip:'34787',addressType:'residential',limitedAccess:false};
  const fq=await require('../../integrations/freight/service').createQuote(1,{...dest,products});
  const {order}=await orders.reserveOrder({...data(),products,delivey_type:'freight',freightDestination:dest,freightAddress:address,freightQuoteId:fq.id});
  expect(order.shippingExpectedCents).toBe(25000);expect(order.parcelQuoteId).toBeNull();
  expect(require('../../integrations/parcel/fedex').calculate).not.toHaveBeenCalled();
 });
 test('pickup never needs an address, package or carrier quote',async()=>{await small.update({parcelPackage:null});const {order}=await orders.reserveOrder({...data(),delivey_type:'pickup',shippingAddress:null});expect(order.shippingExpectedCents).toBe(0);expect(require('../../integrations/parcel/fedex').calculate).not.toHaveBeenCalled()});
 test('disabled FedEx retains existing shipping but captures site address',async()=>{require('../../integrations/parcel/fedex').enabled.mockReturnValue(false);const {order}=await orders.reserveOrder(data());expect(order.shippingExpectedCents).toBe(0);expect(order.shippingAddress).toEqual(address)});
 test('package edits cannot write Checkmate data or prices',async()=>{const pack={weightLb:2,lengthIn:10,widthIn:8,heightIn:6};await small.update({source:'carparts'});await require('../../integrations/parcel/packages').save(small.id,pack);await small.reload();expect(small.parcelPackage).toEqual(pack);expect(small.price).toBe(50);expect(require('../../integrations/carparts/transport').bridge).not.toHaveBeenCalled()});
 test('quote endpoints require authentication and package edits require admin',async()=>{const app=require('../../utils/server')(),r=require('supertest');expect((await r(app).post('/api/public/order/parcel-quote').send(input())).status).toBe(401);expect((await r(app).put(`/api/admin/product/${small.id}/parcel-package`).send({parcelPackage:small.parcelPackage})).status).toBe(401);expect((await r(app).get('/api/admin/parcel/quotes')).status).toBe(401)});
});
