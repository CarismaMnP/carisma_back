jest.mock('../../integrations/carparts/transport',()=>({bridge:jest.fn(()=>{throw Error('No live Checkmate writes in freight tests');})}));
jest.mock('../../integrations/freight/savtrans',()=>({calculate:jest.fn(async()=>({reference:'abc',insuranceCents:1260,rates:[{carrier:'Test Carrier',amountCents:22961}],selected:{carrier:'Test Carrier',amountCents:22961}}))}));
const suite=process.env.CARPARTS_TEST_DB==='true'?describe:describe.skip;
suite('freight checkout transactions',()=>{
 let sequelize,m,service,orders;let big,small;
 const dest={zip:'34787',addressType:'residential',limitedAccess:false};
 const addr={line1:'1 Test St',line2:'',city:'Winter Garden',state:'FL',postal_code:'34787',country:'US'};
 const products=()=>[{productId:big.id,count:1},{productId:small.id,count:2}];
 const orderData=()=>({userId:1,fullName:'Test',mail:'test@example.invalid',phone:'9045550100',delivey_type:'freight',products:products(),freightDestination:dest,freightAddress:addr});
 beforeAll(async()=>{
  if(!/^carisma_sync_test_/.test(process.env.DB_NAME||''))throw Error('Test database required');
  ({sequelize}=require('../../db'));m=require('../../models/models');service=require('../../integrations/freight/service');orders=require('../../integrations/carparts/orders');
  await sequelize.sync({force:true});await m.User.bulkCreate([{id:1,mail:'test@example.invalid'},{id:2,mail:'other@example.invalid'}]);
 },30000);
 afterAll(async()=>{if(sequelize)await sequelize.close();});
 beforeEach(async()=>{
  await sequelize.query('TRUNCATE freight_quotes, carparts_jobs, "cartProducts", "orderProducts", orders, products RESTART IDENTITY CASCADE');
  big=await m.Product.create({name:'Door',link:'door',images:[],price:700,count:2,source:'manual',freightCategoryCode:'FDR'});
  small=await m.Product.create({name:'Engine hose',link:'hose',images:[],price:10,count:5,source:'manual'});
  require('../../integrations/freight/savtrans').calculate.mockClear();
 });
 const quote=()=>service.createQuote(1,{...dest,products:products()});
 test('mixed basket contains separate large pallets and insurance only for those parts',async()=>{
  const second=await m.Product.create({name:'Engine',link:'engine',images:[],price:1000,count:1,source:'manual',freightCategoryCode:'ENG'});
  const q=await service.createQuote(1,{...dest,products:[...products(),{productId:second.id,count:1}]});
  const saved=await m.FreightQuote.findByPk(q.id);
  expect(saved.request.insuredCents).toBe(170000);expect(saved.request.shipmentItems.map(x=>x.code)).toEqual(['FDR','ENG']);
  expect(saved.request.accessorials).toEqual([4,8]);expect(saved.request.cart).toHaveLength(3);
 });
 test('quote does not reserve stock and duplicate request reuses saved rate',async()=>{
  const a=await quote(),b=await quote();expect(a.id).toBe(b.id);expect(await m.FreightQuote.count()).toBe(1);
  expect(require('../../integrations/freight/savtrans').calculate).toHaveBeenCalledTimes(1);expect((await big.reload()).count).toBe(2);
 });
 test('concurrent duplicate calculations create at most one broker call',async()=>{
  const result=await Promise.allSettled([quote(),quote()]);expect(result.some(x=>x.status==='fulfilled')).toBe(true);
  expect(require('../../integrations/freight/savtrans').calculate).toHaveBeenCalledTimes(1);
 });
 test('server quote and full delivery address are captured before reserving stock',async()=>{
  const q=await quote();const result=await orders.reserveOrder({...orderData(),freightQuoteId:q.id,shippingAmount:0});
  expect(result.order.shippingExpectedCents).toBe(22961);expect(result.order.sum).toBe(720);
  expect(result.order.freightAddress).toEqual(addr);expect(result.order.freightSnapshot.request.shipmentItems).toHaveLength(1);
  expect((await big.reload()).count).toBe(1);expect((await small.reload()).count).toBe(3);
  await orders.releaseReservation(result.order.id);expect((await big.reload()).count).toBe(2);
 });
 test.each(['ups',undefined,'courier'])('cannot skip quote via delivery type %s',async type=>{
  await expect(orders.reserveOrder({...orderData(),delivey_type:type})).rejects.toThrow();expect(await m.Order.count()).toBe(0);expect((await big.reload()).count).toBe(2);
 });
 test('large parts can use free pickup without broker contact',async()=>{
  const {order}=await orders.reserveOrder({...orderData(),delivey_type:'pickup'});
  expect(order.shippingExpectedCents).toBe(0);expect(order.freightQuoteId).toBeFalsy();expect(require('../../integrations/freight/savtrans').calculate).not.toHaveBeenCalled();
 });
 test('ordinary small orders keep shipping behavior',async()=>{
  const {order}=await orders.reserveOrder({...orderData(),products:[{productId:small.id,count:1}],delivey_type:'ups'});
  expect(order.sum).toBe(10);expect(order.shippingExpectedCents).toBe(0);expect(order.freightQuoteId).toBeFalsy();
 });
 test.each(['owner','expiry','price','quantity','zip','addressType','access','address'])('rejects changed quote: %s',async change=>{
  const q=await quote(), data={...orderData(),freightQuoteId:q.id};
  if(change==='owner')data.userId=2;
  if(change==='expiry')await m.FreightQuote.update({expiresAt:new Date(0)},{where:{id:q.id}});
  if(change==='price')await big.update({price:701});
  if(change==='quantity')data.products=[{productId:big.id,count:2}];
  if(change==='zip')data.freightDestination={...dest,zip:'10001'};
  if(change==='addressType')data.freightDestination={...dest,addressType:'business'};
  if(change==='access')data.freightDestination={...dest,limitedAccess:true};
  if(change==='address')data.freightAddress={...addr,postal_code:'10001'};
  await expect(orders.reserveOrder(data)).rejects.toThrow();expect(await m.Order.count()).toBe(0);expect((await big.reload()).count).toBe(2);
 });
 test('broker failures are logged and never become free delivery',async()=>{
  require('../../integrations/freight/savtrans').calculate.mockRejectedValueOnce(Error('No freight rates are available for this destination'));
  await expect(quote()).rejects.toThrow('No freight rates');
  const q=await m.FreightQuote.findOne();expect(q.status).toBe('failed');expect(q.amountCents).toBeNull();
  await expect(orders.reserveOrder({...orderData(),freightQuoteId:q.id})).rejects.toThrow();
 });
 test('new endpoints require authentication and restrict quote history to administrators',async()=>{
  const request=require('supertest');const app=require('../../utils/server')();
  expect((await request(app).post('/api/public/order/freight-quote').send({...dest,products:products()})).status).toBe(401);
  expect((await request(app).get('/api/admin/freight/quotes')).status).toBe(401);
 });
 test('invalid ZIP and empty basket fail before calling the broker',async()=>{
  await expect(service.createQuote(1,{...dest,zip:'../../',products:products()})).rejects.toThrow();
  await expect(service.createQuote(1,{...dest,products:[]})).rejects.toThrow();
  expect(require('../../integrations/freight/savtrans').calculate).not.toHaveBeenCalled();
 });
 test('additive migration backfills exact Checkmate codes and the manual engine profile',async()=>{
  const q=sequelize.getQueryInterface(),S=require('sequelize');
  await m.Product.create({name:'Native transmission',link:'native',images:[],source:'carparts',carpartsData:{part:'TRA'},count:1,price:200});
  await big.update({ebayCategory:'Engine'});
  await q.dropTable('freight_quotes');
  for(const c of ['carpartsPartCode','freightCategoryCode'])await q.removeColumn('products',c);
  for(const c of ['freightQuoteId','freightSnapshot','freightAddress','shippingExpectedCents','stripeCustomerId','shippingReview'])await q.removeColumn('orders',c);
  await require('../../migrations/20261019010000-freight-quotes').up(q,S);
  expect((await m.Product.findOne({where:{source:'carparts'}})).carpartsPartCode).toBe('TRA');
  expect((await big.reload()).freightCategoryCode).toBe('ENG');
  expect((await small.reload()).freightCategoryCode).toBeNull();
  expect(await m.FreightQuote.count()).toBe(0);
 });

});
