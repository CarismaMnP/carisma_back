// Only isolated Postgres; no real payment, Checkmate, mail or shipping provider.
jest.mock('../../integrations/carparts/transport',()=>({bridge:jest.fn(()=>{throw Error('No Checkmate writes in resale tests')})}));
jest.mock('../../utils/stripe',()=>({stripe:{checkout:{sessions:{retrieve:jest.fn(),expire:jest.fn()}}},createCheckoutSession:jest.fn()}));
jest.mock('../../utils/mailer',()=>({sendOrderConfirmation:jest.fn(),sendOrderNotification:jest.fn()}));
const suite=process.env.CARPARTS_TEST_DB==='true'?describe:describe.skip;
suite('private resale applications and checkout tax snapshots',()=>{
 let sequelize,m,app,request,tokens,stripe,product;const sessions=new Map();
 const pdf=Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF');
 const payload=extra=>({products:[{productId:product.id,count:1}],fullName:'Test buyer',mail:'buyer@example.invalid',phone:'9045550100',delivey_type:'pickup',...extra});
 const auth=(req,who=1)=>req.set('Authorization','Bearer '+tokens[who]);
 const upload=(who=1,name='certificate.pdf',bytes=pdf)=>auth(request(app).post('/api/public/user/resale'),who).field('companyName','Test Reseller LLC').attach('document',bytes,name);
 const review=(id,decision='approved',comment='',who=3)=>auth(request(app).post(`/api/admin/resale/${id}/review`),who).send({decision,comment});
 const create=extra=>auth(request(app).post('/api/public/order')).send(payload(extra));
 const status=who=>auth(request(app).get('/api/public/user/resale'),who);
 beforeAll(async()=>{
  if(!/^carisma_sync_test_/.test(process.env.DB_NAME||''))throw Error('Isolated DB required');
  ({sequelize}=require('../../db'));m=require('../../models/models');stripe=require('../../utils/stripe');
  await sequelize.sync({force:true});
  // Exercise the actual reversible production migration, including unique indexes.
  const migration=require('../../migrations/20261030010000-resale-certificates');
  await migration.down(sequelize.getQueryInterface());await migration.up(sequelize.getQueryInterface(),require('sequelize'));
  process.env.SECRET_KEY='resale-isolated-test';const jwt=require('jsonwebtoken');tokens={};
  for(const id of [1,2,3])tokens[id]=jwt.sign({id,role:'ADMINISTRATOR'},process.env.SECRET_KEY);
  app=require('../../utils/server')();request=require('supertest');
 },30000);
 afterAll(async()=>{await sequelize.close()});
 beforeEach(async()=>{
  jest.clearAllMocks();sessions.clear();
  await sequelize.query('TRUNCATE resale_reviews,resale_applications,users,orders,products RESTART IDENTITY CASCADE');
  await m.User.bulkCreate([{id:1,mail:'buyer@example.invalid'},{id:2,mail:'other@example.invalid'},{id:3,mail:'admin@example.invalid',role:'ADMINISTRATOR'}]);
  product=await m.Product.create({name:'Test part',link:'test',images:[],price:100,count:10,source:'manual'});
  stripe.createCheckoutSession.mockImplementation(async({orderId})=>{const id='cs_'+orderId,expires_at=Math.floor(Date.now()/1000)+1800;sessions.set(id,{id,mode:'payment',metadata:{orderId},status:'open',payment_status:'unpaid',expires_at,url:'https://checkout.stripe.com/c/pay/'+id});return {sessionId:id,customerId:'cus_'+orderId,url:sessions.get(id).url,expiresAt:new Date(expires_at*1000)}});
  stripe.stripe.checkout.sessions.retrieve.mockImplementation(async id=>sessions.get(id));
  stripe.stripe.checkout.sessions.expire.mockImplementation(async id=>{sessions.get(id).status='expired';return sessions.get(id)});
 });
 test('upload remains taxable, private, persisted and visible to owner/admin only',async()=>{
  const r=await upload();expect(r.status).toBe(201);expect(r.body.approved).toBe(false);expect(r.body.latest.status).toBe('pending');
  expect(JSON.stringify(r.body)).not.toMatch(/documentData|sha256/);const id=r.body.latest.id;
  expect((await status(2)).body.latest).toBeNull();
  expect((await auth(request(app).get(`/api/public/user/resale/${id}/document`),2)).status).toBe(404);
  const d=await auth(request(app).get(`/api/public/user/resale/${id}/document`));expect(d.status).toBe(200);expect(d.headers['cache-control']).toContain('no-store');expect(d.headers['content-disposition']).toContain('attachment');expect(d.headers['x-content-type-options']).toBe('nosniff');expect(d.body).toEqual(pdf);
  expect((await request(app).get(`/api/public/user/resale/${id}/document`)).status).toBe(401);
  expect((await auth(request(app).get('/api/admin/resale'),2)).status).toBe(403);
  const list=await auth(request(app).get('/api/admin/resale?search=Test%20Reseller'),3);expect(list.status).toBe(200);expect(list.body.count).toBe(1);expect(JSON.stringify(list.body)).not.toMatch(/documentData|password|emailLoginCode/);
  const order=await create({resaleRequested:true,resaleTaxExempt:true,resaleTaxExemptExpected:false});expect(order.status).toBe(200);
  expect(stripe.createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({resaleTaxExempt:false,resaleApplicationId:id}));
  expect((await m.Order.findByPk(order.body.invoiceId)).resaleSnapshot.status).toBe('pending');
 });
 test('no document blocks checked checkout, unselected normal checkout works',async()=>{
  expect((await create({resaleRequested:true})).status).toBe(400);expect(await m.Order.count()).toBe(0);expect((await product.reload()).count).toBe(10);
  expect((await create({resaleRequested:false,resaleTaxExempt:true})).status).toBe(200);expect(stripe.createCheckoutSession.mock.calls[0][0].resaleTaxExempt).toBe(false);
 });
 test('approval sets user flag; approved selected new orders exempt, unselected taxable',async()=>{
  const id=(await upload()).body.latest.id;expect((await review(id)).status).toBe(200);
  const u=await m.User.findByPk(1);expect(u.resaleTaxExempt).toBe(true);expect(u.resaleCertificateId).toBe(id);
  const a=await create({resaleRequested:true,resaleTaxExemptExpected:true});expect(a.status).toBe(200);
  const order=await m.Order.findByPk(a.body.invoiceId);expect(order.resaleTaxExempt).toBe(true);expect(order.resaleSnapshot.reviewedBy).toBe(3);
  expect(stripe.createCheckoutSession.mock.calls[0][0].resaleTaxExempt).toBe(true);
  expect((await create({resaleRequested:false})).status).toBe(409);
  await auth(request(app).post(`/api/public/order/${order.id}/cancel`)).send({});
  const b=await create({resaleRequested:false});expect(b.status).toBe(200);expect(stripe.createCheckoutSession.mock.calls[1][0].resaleTaxExempt).toBe(false);
 });
 test('reject requires comment, shows it in profile, resubmission can be approved',async()=>{
  const id=(await upload()).body.latest.id;expect((await review(id,'rejected')).status).toBe(400);
  expect((await review(id,'rejected','Please provide a signed certificate.')).status).toBe(200);
  expect((await status(1)).body.latest.reviewComment).toBe('Please provide a signed certificate.');
  expect((await create({resaleRequested:true})).status).toBe(400);
  const next=(await upload()).body.latest.id;expect(next).not.toBe(id);expect((await review(next)).status).toBe(200);
  expect((await status(1)).body.history).toHaveLength(2);
 });
 test('obsolete / duplicate decisions cannot approve replaced documents',async()=>{
  const old=(await upload()).body.latest.id,next=(await upload()).body.latest.id;
  expect((await review(old)).status).toBe(409);expect((await review(next)).status).toBe(200);expect((await review(next)).status).toBe(409);
  expect((await m.ResaleReview.findAll({where:{applicationId:old}}))[0].toStatus).toBe('superseded');
 });
 test('replacement pending/rejected preserves existing approval; replacement approval supersedes it',async()=>{
  const old=(await upload()).body.latest.id;await review(old);
  const next=(await upload()).body.latest.id;expect((await status(1)).body.approved).toBe(true);
  await review(next,'rejected','Incorrect replacement');expect((await status(1)).body.active.id).toBe(old);
  const third=(await upload()).body.latest.id;await review(third);expect((await status(1)).body.active.id).toBe(third);expect((await m.ResaleApplication.findByPk(old)).status).toBe('superseded');
 });
 test('approval/revocation never changes previous orders; resume preserves tax snapshot',async()=>{
  const cert=(await upload()).body.latest.id,first=await create({resaleRequested:true,resaleTaxExemptExpected:false});
  await review(cert);expect((await m.Order.findByPk(first.body.invoiceId)).resaleTaxExempt).toBe(false);
  const again=await create({resaleRequested:true,resaleTaxExemptExpected:true});expect(again.body.reused).toBe(true);expect(stripe.createCheckoutSession).toHaveBeenCalledTimes(1);
  const history=await auth(request(app).get('/api/public/order/history'));expect(history.body.rows[0].resaleTaxExempt).toBe(false);
  await auth(request(app).post(`/api/public/order/${first.body.invoiceId}/cancel`)).send({});
  const second=await create({resaleRequested:true,resaleTaxExemptExpected:true});await review(cert,'revoked','Certificate withdrawn');
  expect((await m.Order.findByPk(second.body.invoiceId)).resaleTaxExempt).toBe(true);expect((await status(1)).body.approved).toBe(false);
 });
 test('approval changes during checkout fail clearly without reserving stock',async()=>{
  const id=(await upload()).body.latest.id;await review(id);
  const result=await create({resaleRequested:true,resaleTaxExemptExpected:false});expect(result.status).toBe(409);expect(await m.Order.count()).toBe(0);expect((await product.reload()).count).toBe(10);
 });
 test('profile update and stale admin claims cannot self-approve',async()=>{
  await auth(request(app).put('/api/public/user')).send({name:'Buyer',resaleTaxExempt:true,resaleCertificateId:'00000000-0000-0000-0000-000000000000'});
  expect((await m.User.findByPk(1)).resaleTaxExempt).toBe(false);
  const id=(await upload()).body.latest.id;expect((await review(id,'approved','',1)).status).toBe(403);
  await m.User.update({role:'USER'},{where:{id:3}});expect((await review(id)).status).toBe(403);
 });
 test('administrator cannot approve their own certificate',async()=>{
  const id=(await upload(3)).body.latest.id;expect((await review(id)).status).toBe(403);
 });
 test('concurrent reviews serialize and preserve one decision and one audit record',async()=>{
  const id=(await upload()).body.latest.id;
  const results=await Promise.all([review(id),review(id,'rejected','Invalid')]);expect(results.map(r=>r.status).sort()).toEqual([200,409]);
  expect(await m.ResaleReview.count({where:{applicationId:id}})).toBe(1);
 });
 test('forged, excessive, multiple and unauthenticated uploads are rejected',async()=>{
  expect((await upload(1,'test.exe')).status).toBe(400);
  expect((await upload(1,'test.pdf',Buffer.from('<html>not a PDF</html>'))).status).toBe(400);
  expect((await upload(1,'test.pdf',Buffer.alloc(10*1024*1024+1))).status).toBe(413);
  expect((await request(app).post('/api/public/user/resale').attach('document',pdf,'test.pdf')).status).toBe(401);
  const multiple=await auth(request(app).post('/api/public/user/resale')).field('companyName','Test').attach('document',pdf,'one.pdf').attach('document',pdf,'two.pdf');
  expect(multiple.status).toBeGreaterThanOrEqual(400);expect(await m.ResaleApplication.count()).toBe(0);
 });
 test('upload rate is bounded per customer',async()=>{for(let i=0;i<5;i++)expect((await upload()).status).toBe(201);expect((await upload()).status).toBe(429)});
});
