jest.mock('../../integrations/carparts/transport',()=>({bridge:jest.fn(()=>{throw Error('No Checkmate calls in refund tests')})}));
jest.mock('../../utils/mailer',()=>({sendOrderConfirmation:jest.fn(),sendOrderNotification:jest.fn()}));
jest.mock('../../utils/stripe',()=>{
 const sdk=new(require('stripe'))('sk_test_fixture');
 return {stripe:{refunds:{create:jest.fn(()=>{throw Error('Refunds are manual only')})}},
  verifyWebhookSignature:(payload,signature)=>sdk.webhooks.constructEvent(payload,signature,'whsec_refund_fixture'),
  getCheckoutSession:jest.fn(),createCheckoutSession:jest.fn(),stripeForOrder:jest.fn()};
});
const suite=process.env.CARPARTS_TEST_DB==='true'?describe:describe.skip;
suite('return requests, manual approval and Stripe callbacks',()=>{
 let sequelize,m,app,request,tokens,order,product,service;
 const auth=(req,id=1)=>req.set('Authorization','Bearer '+tokens[id]);
 const submit=(id=order.id,who=1,reason='The part does not fit my vehicle.')=>auth(request(app).post(`/api/public/order/${id}/refund`),who).send({reason});
 const review=(id,decision='approved',comment='',who=3)=>auth(request(app).post(`/api/admin/refunds/${id}/review`),who).send({decision,comment,confirmManualRefund:true});
 const refund=(amount=9000,extra={})=>({id:'ch_refund_fixture',object:'charge',payment_intent:'pi_refund_fixture',amount:10000,amount_captured:10000,amount_refunded:amount,refunded:amount===10000,currency:'usd',livemode:true,...extra});
 const webhook=(charge,eventId='evt_refund_fixture',created=Math.floor(Date.now()/1000),live=true)=>{
  const payload=JSON.stringify({id:eventId,type:'charge.refunded',created,livemode:live,data:{object:charge}});
  const signature=new(require('stripe'))('sk_test_fixture').webhooks.generateTestHeaderString({payload,secret:'whsec_refund_fixture'});
  return request(app).post('/api/public/stripe-webhook').set('Content-Type','application/json').set('stripe-signature',signature).send(payload);
 };
 beforeAll(async()=>{
  if(!/^carisma_sync_test_/.test(process.env.DB_NAME||''))throw Error('Isolated DB required');
  ({sequelize}=require('../../db'));m=require('../../models/models');await sequelize.sync({force:true});
  const migration=require('../../migrations/20261030030000-refund-requests');await migration.down(sequelize.getQueryInterface());await migration.up(sequelize.getQueryInterface(),require('sequelize'));
  process.env.SECRET_KEY='refund-isolated-test';tokens={};for(const id of [1,2,3,4])tokens[id]=require('jsonwebtoken').sign({id,role:'ADMINISTRATOR'},process.env.SECRET_KEY);
  service=require('../../integrations/refunds/service');app=require('../../utils/server')();request=require('supertest');
 },30000);
 afterAll(async()=>sequelize.close());
 beforeEach(async()=>{
  jest.clearAllMocks();await sequelize.query('TRUNCATE users,orders,products,carparts_jobs RESTART IDENTITY CASCADE');
  await m.User.bulkCreate([{id:1,mail:'buyer@example.invalid'},{id:2,mail:'other@example.invalid'},{id:3,mail:'admin@example.invalid',role:'ADMINISTRATOR'},{id:4,mail:'reviewer@example.invalid',role:'ADMINISTRATOR'}]);
  product=await m.Product.create({name:'Test part',link:'test-part',images:[],price:100,count:0,source:'carparts',carpartsGuid:'11111111-1111-4111-8111-111111111111',websiteSold:true});
  order=await m.Order.create({userId:1,state:'delivered',sum:100,total:100,stockReservedAt:new Date(),stockAppliedAt:new Date(),paidAt:new Date(),paidLive:true,stripePaymentIntentId:'pi_refund_fixture'});
  await m.OrderProduct.create({orderId:order.id,productId:product.id,count:1,unitPriceCents:10000});
  await m.CarpartsJob.create({orderId:order.id,productId:product.id,guid:product.carpartsGuid,state:'done'});
 });
 test('only owner can request; a reason is mandatory and duplicate submissions return one request',async()=>{
  expect((await submit(order.id,2)).status).toBe(404);expect((await submit(order.id,1,'   ')).status).toBe(400);expect((await submit(order.id,1,'x'.repeat(2001))).status).toBe(400);
  expect((await request(app).post(`/api/public/order/${order.id}/refund`).send({reason:'Invalid item'})).status).toBe(401);
  const [a,b]=await Promise.all([submit(),submit()]);expect(a.status).toBe(200);expect(b.status).toBe(200);expect(a.body.request.id).toBe(b.body.request.id);expect(await m.RefundRequest.count()).toBe(1);
  expect((await order.reload()).state).toBe('delivered');expect((await product.reload()).count).toBe(0);
  const history=await auth(request(app).get('/api/public/order/history'));expect(history.body.rows[0].refundRequest.reason).toContain('vehicle');expect(history.body.rows[0].canRequestRefund).toBe(false);
  expect((await auth(request(app).get('/api/public/order/history'),2)).body.rows).toEqual([]);
 });
 test.each(['pending','processing','expired','confirmed','delivery','canceled','refunded','disputed'])('rejects refund requests for %s orders',async state=>{await order.update({state});expect((await submit()).status).toBe(409);expect(await m.RefundRequest.count()).toBe(0)});
 test('completed pickup and legacy delivered orders can request a return',async()=>{await order.update({state:'completed',delivey_type:'pickup',paidAt:null,stockAppliedAt:null,stockReservedAt:null});expect((await submit()).status).toBe(200)});
 test('approval sets refunded without Stripe writes, inventory changes, Checkmate jobs or mail',async()=>{
  const id=(await submit()).body.request.id;const r=await review(id);expect(r.status).toBe(200);expect((await order.reload()).state).toBe('refunded');
  const before=(await m.RefundRequest.findByPk(id)).reviewedAt;expect((await review(id)).body.alreadyReviewed).toBe(true);expect((await m.RefundRequest.findByPk(id)).reviewedAt).toEqual(before);
  expect((await product.reload()).count).toBe(0);expect(product.websiteSold).toBe(true);expect(await m.CarpartsJob.count()).toBe(1);
  expect(require('../../utils/stripe').stripe.refunds.create).not.toHaveBeenCalled();expect(require('../../utils/mailer').sendOrderNotification).not.toHaveBeenCalled();
 });
 test('rejection needs a comment; customer sees it, order stays delivered',async()=>{
  const id=(await submit()).body.request.id;expect((await review(id,'rejected','')).status).toBe(400);expect((await review(id,'rejected','Please contact us about the damaged packaging.')).status).toBe(200);
  expect((await order.reload()).state).toBe('delivered');const history=await auth(request(app).get('/api/public/order/history'));expect(history.body.rows[0].refundRequest.status).toBe('rejected');expect(history.body.rows[0].refundRequest.reviewComment).toContain('packaging');
  expect((await review(id)).status).toBe(409);
 });
 test('authorization is checked against current role and decisions serialize',async()=>{
  const id=(await submit()).body.request.id;expect((await auth(request(app).get('/api/admin/refunds'),1)).status).toBe(403);expect((await review(id,'approved','',1)).status).toBe(403);
  await m.User.update({role:'USER'},{where:{id:4}});expect((await review(id,'approved','',4)).status).toBe(403);
  const r=await Promise.all([review(id),review(id,'rejected','Not eligible')]);expect(r.map(x=>x.status).sort()).toEqual([200,409]);
 });
 test('admin list includes items/contact info, filters and no user secrets',async()=>{
  await submit();const r=await auth(request(app).get('/api/admin/refunds?status=pending'),3);expect(r.status).toBe(200);expect(r.body.count).toBe(1);expect(r.body.rows[0].order.orderProducts).toHaveLength(1);expect(JSON.stringify(r.body)).not.toMatch(/password|emailLoginCode|smsCode/);
  expect((await auth(request(app).get('/api/admin/refunds?status=bad'),3)).status).toBe(400);
  expect((await auth(request(app).get('/api/admin/order').query({orderId:order.id}),3)).body.rows).toHaveLength(1);
 });
 test('approved return plus partial Stripe refund retains refunded and records actual amount',async()=>{
  const id=(await submit()).body.request.id;await review(id);expect((await webhook(refund(9000))).status).toBe(200);
  expect((await order.reload()).state).toBe('refunded');expect(order.stripeRefundedCents).toBe(9000);
  const snapshot=order.stripeRefundUpdatedAt;await webhook(refund(9000));await webhook(refund(1000),'evt_old',1000);await order.reload();expect(order.stripeRefundedCents).toBe(9000);expect(order.stripeRefundUpdatedAt).toEqual(snapshot);
  expect(await m.CarpartsJob.count()).toBe(1);expect((await product.reload()).count).toBe(0);
 });
 test('partial Stripe refund before approval preserves delivery state; full refund and later approval are safe',async()=>{
  const id=(await submit()).body.request.id;await webhook(refund(5000));expect((await order.reload()).state).toBe('delivered');
  await webhook(refund(10000));expect((await order.reload()).state).toBe('refunded');expect((await review(id)).status).toBe(200);
  await webhook(refund(2500),'evt_late',1000);expect((await order.reload()).stripeRefundedCents).toBe(10000);expect(order.state).toBe('refunded');
 });
 test('full webhook and manual review racing share an order lock',async()=>{
  const id=(await submit()).body.request.id;const responses=await Promise.all([review(id),webhook(refund(10000))]);expect(responses.map(x=>x.status)).toEqual([200,200]);expect((await order.reload()).state).toBe('refunded');expect(order.stripeRefundedCents).toBe(10000);
 });
 test('late payment callback and stale admin edits cannot reopen refunded orders',async()=>{
  const id=(await submit()).body.request.id;await review(id);
  await expect(require('../../integrations/carparts/admin-orders').updateAdminOrder(order.id,{state:'delivered'})).rejects.toThrow();
  // Legacy order without stockAppliedAt is also protected from an old payment retry.
  await order.update({stockAppliedAt:null,paidAt:null});
  const r=await require('../../integrations/carparts/orders').confirmPayment(order.id,{paymentIntentId:'pi_refund_fixture',paidLive:true});expect(r.applied).toBe(false);expect((await order.reload()).state).toBe('refunded');expect(await m.CarpartsJob.count()).toBe(1);
 });
 test('refund before payment confirmation can match trusted charge metadata',async()=>{
  await order.update({state:'pending',stripePaymentIntentId:null,stockAppliedAt:null,paidAt:null});
  expect((await webhook(refund(10000,{metadata:{orderId:order.id}}))).status).toBe(200);expect((await order.reload()).state).toBe('refunded');expect(order.stripePaymentIntentId).toBe('pi_refund_fixture');
  const r=await require('../../integrations/carparts/orders').confirmPayment(order.id,{paymentIntentId:'pi_refund_fixture',paidLive:true});expect(r.applied).toBe(false);
  expect(await require('../../integrations/carparts/orders').releaseReservation(order.id,'expired')).toBe(false);expect((await order.reload()).state).toBe('refunded');expect((await product.reload()).count).toBe(0);
 });
 test('invalid signatures, wrong payments and test callbacks cannot change live orders',async()=>{
  expect((await request(app).post('/api/public/stripe-webhook').set('Content-Type','application/json').set('stripe-signature','invalid').send('{}')).status).toBe(400);
  expect((await webhook(refund(10000,{payment_intent:'pi_unknown'}))).status).toBe(200);expect((await order.reload()).state).toBe('delivered');
  expect((await webhook(refund(10000,{payment_intent:'pi_unknown',metadata:{orderId:'-'.repeat(36)}}))).status).toBe(200);
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';try{expect((await webhook(refund(10000,{livemode:false}),'evt_test',Math.floor(Date.now()/1000),false)).status).toBe(200)}finally{process.env.NODE_ENV=previous}
  expect((await order.reload()).state).toBe('delivered');expect(order.stripeRefundedCents).toBe(0);
 });
});
