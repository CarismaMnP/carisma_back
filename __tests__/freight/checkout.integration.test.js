// Isolated DB only: no Checkmate, broker, real Stripe or email calls.
jest.mock('../../integrations/carparts/transport',()=>({bridge:jest.fn(()=>{throw Error('No live Checkmate in checkout tests')})}));
jest.mock('../../utils/stripe',()=>({stripe:{checkout:{sessions:{retrieve:jest.fn(),expire:jest.fn()}}},createCheckoutSession:jest.fn()}));
jest.mock('../../integrations/freight/addresses',()=>({lookupZip:jest.fn(async()=>({places:[{city:'Winter Garden',state:'FL'}]}))}));
const suite=process.env.CARPARTS_TEST_DB==='true'?describe:describe.skip;
suite('customer checkout continuation',()=>{
 let sequelize,m,checkout,orders,stripe,app,request,token,otherToken,product;const sessions=new Map();
 const products=()=>[{productId:product.id,count:1}];
 const input=()=>({products:products(),fullName:'Test Buyer',mail:'test@example.invalid',phone:'9045550100',delivey_type:'pickup'});
 beforeAll(async()=>{
  if(!/^carisma_sync_test_/.test(process.env.DB_NAME||''))throw Error('Isolated DB required');
  ({sequelize}=require('../../db'));m=require('../../models/models');checkout=require('../../integrations/carparts/checkout');orders=require('../../integrations/carparts/orders');stripe=require('../../utils/stripe');
  await sequelize.sync({force:true});await m.User.bulkCreate([{id:1,mail:'one@example.invalid'},{id:2,mail:'two@example.invalid'}]);
  const express=require('express');app=express();app.use(express.json());app.use('/order',require('../../routes/public/orderRouter'));request=require('supertest');
  process.env.SECRET_KEY='isolated-checkout-tests';const jwt=require('jsonwebtoken');token=jwt.sign({id:1},process.env.SECRET_KEY);otherToken=jwt.sign({id:2},process.env.SECRET_KEY);
 },30000);
 afterAll(async()=>{if(sequelize)await sequelize.close()});
 beforeEach(async()=>{
  jest.clearAllMocks();sessions.clear();await sequelize.query('TRUNCATE freight_quotes,carparts_jobs,"cartProducts","orderProducts",orders,products RESTART IDENTITY CASCADE');
  product=await m.Product.create({name:'Test hose',link:'test-hose',images:[],price:25,count:3,source:'manual'});
  stripe.createCheckoutSession.mockImplementation(async({orderId})=>{const id='cs_'+orderId,expires_at=Math.floor(Date.now()/1000)+1800;sessions.set(id,{id,mode:'payment',metadata:{orderId},status:'open',payment_status:'unpaid',expires_at,url:'https://checkout.stripe.com/c/pay/'+id});return {sessionId:id,url:sessions.get(id).url,expiresAt:new Date(expires_at*1000)}});
  stripe.stripe.checkout.sessions.retrieve.mockImplementation(async id=>{if(!sessions.has(id))throw Error('Unknown');return sessions.get(id)});
  stripe.stripe.checkout.sessions.expire.mockImplementation(async id=>{const s=sessions.get(id);if(s.payment_status==='paid')throw Error('Already paid');s.status='expired';return s});
 });
 const post=(path,body,auth=token)=>request(app).post('/order'+path).set('Authorization','Bearer '+auth).send(body);
 const create=()=>post('',input());
 test('pickup passes only buyer contact to Stripe and persists its per-order customer',async()=>{
  stripe.createCheckoutSession.mockResolvedValueOnce({sessionId:'cs_pickup',url:'https://checkout.stripe.com/c/pay/cs_pickup',customerId:'cus_pickup',expiresAt:new Date(Date.now()+1800000)});
  const a=await post('',{...input(),shippingAddress:{line1:'Untrusted address',state:'NY',postal_code:'10001'},pickup:{address:{state:'NY'}}});
  expect(a.status).toBe(200);
  expect(stripe.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({pickup:{name:'Test Buyer',phone:'9045550100'},collectShippingAddress:false,shipping:null,freight:null}));
  const order=await m.Order.findByPk(a.body.invoiceId);
  expect(order.stripeCustomerId).toBe('cus_pickup');expect(order.shippingAddress).toBeNull();expect(order.shippingExpectedCents).toBe(0);
 });
 test('repeat create returns identical Stripe session without a second order or reservation',async()=>{
  const a=await create(),b=await create();expect(a.status).toBe(200);expect(b.status).toBe(200);expect(b.body.paymentUrl).toBe(a.body.paymentUrl);expect(b.body.reused).toBe(true);
  expect(await m.Order.count()).toBe(1);expect((await product.reload()).count).toBe(2);expect(stripe.createCheckoutSession).toHaveBeenCalledTimes(1);
 });
 test('checkout detects own reserved basket before free-stock validation',async()=>{
  await product.update({count:1});const a=await create();expect(a.status).toBe(200);
  const r=await post('/shipping-requirements',{products:products()});expect(r.status).toBe(200);expect(r.body.pendingOrder.id).toBe(a.body.invoiceId);expect(r.body.pendingOrder.canResume).toBe(true);
  const other=await post('/shipping-requirements',{products:products()},otherToken);expect(other.status).toBe(400);expect(other.body.pendingOrder).toBeUndefined();
 });
 test('only exact product quantities match; reordered and duplicate rows normalize',async()=>{
  await create();expect(await checkout.matchingOrder(1,[{productId:product.id,count:2}])).toBeNull();expect(await checkout.matchingOrder(2,products())).toBeNull();
  expect(checkout.sameItems([{productId:1,count:1},{productId:1,count:1},{productId:2,count:1}],[{productId:2,count:1},{productId:1,count:2}])).toBe(true);
 });
 test('simultaneous create calls cannot reserve twice even with multiple stock',async()=>{
  const results=await Promise.all([create(),create()]);expect(results.some(x=>x.status===200)).toBe(true);expect(results.every(x=>[200,409].includes(x.status))).toBe(true);
  expect(await m.Order.count()).toBe(1);expect((await product.reload()).count).toBe(2);
 });
 test('resume is authenticated and owner scoped; foreign order never queries Stripe',async()=>{
  const a=await create();stripe.stripe.checkout.sessions.retrieve.mockClear();
  expect((await post(`/${a.body.invoiceId}/resume`,{},otherToken)).status).toBe(404);expect(stripe.stripe.checkout.sessions.retrieve).not.toHaveBeenCalled();
  expect((await request(app).post(`/order/${a.body.invoiceId}/resume`).send({})).status).toBe(401);
  const b=await post(`/${a.body.invoiceId}/resume`,{});expect(b.body.paymentUrl).toBe(a.body.paymentUrl);expect(await m.Order.count()).toBe(1);
 });
 test('expired session releases reservation and checkout can start again',async()=>{
  await product.update({count:1});const a=await create();sessions.get('cs_'+a.body.invoiceId).status='expired';
  expect((await post(`/${a.body.invoiceId}/resume`,{})).status).toBe(409);expect((await product.reload()).count).toBe(1);
  const b=await create();expect(b.status).toBe(200);expect(b.body.invoiceId).not.toBe(a.body.invoiceId);expect((await product.reload()).count).toBe(0);
 });
 test('requirements reconciles expired own reservation immediately',async()=>{
  await product.update({count:1});const a=await create();sessions.get('cs_'+a.body.invoiceId).status='expired';
  const r=await post('/shipping-requirements',{products:products()});expect(r.status).toBe(200);expect(r.body.pendingOrder).toBeUndefined();expect(r.body.requiresFreight).toBe(false);expect((await product.reload()).count).toBe(1);
 });
 test('paid, completed or released order can never be resumed',async()=>{
  const a=await create(),id=a.body.invoiceId;sessions.get('cs_'+id).payment_status='paid';
  expect((await post(`/${id}/resume`,{})).status).toBe(409);expect((await post(`/${id}/cancel`,{})).status).toBe(409);expect((await product.reload()).count).toBe(2);
  await m.Order.update({stockAppliedAt:new Date(),state:'paid'},{where:{id}});expect((await post(`/${id}/resume`,{})).status).toBe(409);
 });
 test('cancel expires Stripe before stock release; repeated cancel never restores twice',async()=>{
  const a=await create(),id=a.body.invoiceId;expect((await post(`/${id}/cancel`,{},otherToken)).status).toBe(404);
  expect((await post(`/${id}/cancel`,{})).status).toBe(200);expect(sessions.get('cs_'+id).status).toBe('expired');expect((await product.reload()).count).toBe(3);
  expect((await post(`/${id}/cancel`,{})).status).toBe(200);expect((await product.reload()).count).toBe(3);expect((await post(`/${id}/resume`,{})).status).toBe(409);
 });
 test('Stripe failure and payment/cancellation race do not release inventory',async()=>{
  const a=await create(),id=a.body.invoiceId;stripe.stripe.checkout.sessions.expire.mockRejectedValueOnce(Error('Already completed'));
  expect((await post(`/${id}/cancel`,{})).status).toBe(409);expect((await product.reload()).count).toBe(2);
  stripe.stripe.checkout.sessions.retrieve.mockRejectedValueOnce(Error('Timeout'));expect((await post(`/${id}/resume`,{})).status).toBe(503);expect((await product.reload()).count).toBe(2);
 });
 test('ambiguous session creation does not create another reservation',async()=>{
  stripe.createCheckoutSession.mockRejectedValueOnce(Error('Timeout'));expect((await create()).status).toBe(400);expect((await create()).status).toBe(409);expect(await m.Order.count()).toBe(1);expect((await product.reload()).count).toBe(2);
 });
 test('history is owner scoped, paginated and excludes payment credentials and integration tests',async()=>{
  const a=await create();await post('',input(),otherToken);
  const h=await request(app).get('/order/history').set('Authorization','Bearer '+token);expect(h.status).toBe(200);expect(h.body.count).toBe(1);expect(h.body.rows[0].id).toBe(a.body.invoiceId);expect(h.body.rows[0].items[0].name).toBe('Test hose');expect(h.body.rows[0].totalCents).toBeNull();expect(JSON.stringify(h.body)).not.toContain('checkout.stripe.com');expect(h.body.rows[0].checkoutSessionId).toBeUndefined();
  await m.Order.update({isIntegrationTest:true},{where:{id:a.body.invoiceId}});expect((await checkout.history(1,1)).count).toBe(0);
 });
 test('resuming freight keeps its frozen delivery amount and never requires a new quote',async()=>{
  const a=await create(),id=a.body.invoiceId;
  await m.Order.update({delivey_type:'freight',shippingAmount:229.61,shippingExpectedCents:22961,freightAddress:{postal_code:'34787',state:'FL'},freightSnapshot:{expiresAt:new Date(0)}},{where:{id}});
  const b=await post(`/${id}/resume`,{});expect(b.status).toBe(200);expect(b.body.paymentUrl).toBe(a.body.paymentUrl);expect((await m.Order.findByPk(id)).shippingExpectedCents).toBe(22961);expect((await product.reload()).count).toBe(2);
 });
 test('invalid metadata and unsafe payment URL are rejected',async()=>{
  const a=await create(),s=sessions.get('cs_'+a.body.invoiceId);s.url='https://example.invalid/phishing';expect((await post(`/${a.body.invoiceId}/resume`,{})).status).toBe(503);s.metadata.orderId='different';expect((await post(`/${a.body.invoiceId}/resume`,{})).status).toBe(409);
 });
});
