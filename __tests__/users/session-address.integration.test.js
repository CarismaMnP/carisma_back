jest.mock('../../utils/mailer',()=>({sendVerificationCode:jest.fn(),sendClientRequest:jest.fn(),sendClientMessage:jest.fn(),sendAdminOrderNotification:jest.fn(),sendOrderConfirmation:jest.fn()}));
jest.mock('../../integrations/carparts/transport',()=>({bridge:jest.fn(()=>{throw Error('No live Checkmate access in account tests')})}));
const jwt=require('jsonwebtoken'),request=require('supertest');
const suite=process.env.CARPARTS_TEST_DB==='true'?describe:describe.skip;
suite('customer session and saved delivery address',()=>{
 let sequelize,m,app;
 const address={line1:'1 Test St',line2:'Suite 2',city:'Davie',state:'FL',postal_code:'33314',country:'US'};
 const token=id=>jwt.sign({id,role:'USER'},process.env.SECRET_KEY,{expiresIn:'1h'});
 const get=(id,url='/order/address/saved')=>request(app).get('/api/public'+url).set('Authorization','Bearer '+token(id));
 const order=(userId,overrides={})=>m.Order.create({userId,state:'paid',sum:20,delivey_type:'ups',shippingAddress:address,...overrides});
 beforeAll(async()=>{
  if(!/^carisma_sync_test_/.test(process.env.DB_NAME||''))throw Error('Isolated test database required');
  ({sequelize}=require('../../db'));m=require('../../models/models');await sequelize.sync({force:true});
  await m.User.bulkCreate([{id:1,mail:'one@example.invalid',role:'USER'},{id:2,mail:'two@example.invalid',role:'USER'},{id:3,mail:'admin@example.invalid',role:'ADMIN'}]);app=require('../../utils/server')();
 },30000);
 afterAll(async()=>{if(sequelize)await sequelize.close()});
 beforeEach(async()=>{await m.Order.destroy({where:{}})});
 test('email login issues a 90 day customer session; profile refresh renews it',async()=>{
  await m.User.update({emailLoginCode:'012345',emailLoginCodeExpiry:new Date(Date.now()+60000)},{where:{id:1}});
  const login=await request(app).post('/api/public/user/login/email/check').send({email:'one@example.invalid',code:'012345'});
  expect(login.status).toBe(200);const payload=jwt.verify(login.body.token,process.env.SECRET_KEY);
  expect(payload.exp-payload.iat).toBe(90*86400);
  expect(()=>jwt.verify(login.body.token,process.env.SECRET_KEY,{clockTimestamp:payload.iat+89*86400})).not.toThrow();
  expect(()=>jwt.verify(login.body.token,process.env.SECRET_KEY,{clockTimestamp:payload.iat+91*86400})).toThrow();
  const renewed=await get(1,'/user/check');expect(renewed.status).toBe(200);
  const fresh=jwt.decode(renewed.body.token);expect(fresh.exp-fresh.iat).toBe(90*86400);
  expect((await m.User.findByPk(1)).emailLoginCode).toBeNull();
  expect(require('../../utils/mailer').sendVerificationCode).not.toHaveBeenCalled();
 });
 test('privileged sessions keep their existing shorter lifetime',async()=>{const r=await get(3,'/user/check');const p=jwt.decode(r.body.token);expect(p.exp-p.iat).toBe(72*3600)});
 test('requires authentication and never returns another owner address',async()=>{
  await order(1);expect((await request(app).get('/api/public/order/address/saved')).status).toBe(401);
  const own=await get(1);expect(own.body.address).toEqual(address);expect(own.headers['cache-control']).toBe('private, no-store');
  expect((await get(2)).body.address).toBeNull();
 });
 test('prefills newest delivery, including unpaid checkout; ignores later pickup and integration tests',async()=>{
  await order(1,{createdAt:new Date('2026-01-01')});
  await order(1,{state:'processing',shippingAddress:{...address,line1:'2 Test St'},createdAt:new Date('2026-01-02')});
  await order(1,{delivey_type:'pickup',shippingAddress:{...address,line1:'Warehouse'},createdAt:new Date('2026-01-03')});
  await order(1,{isIntegrationTest:true,shippingAddress:{...address,line1:'Fixture'},createdAt:new Date('2026-01-04')});
  expect((await get(1)).body.address.line1).toBe('2 Test St');
 });
 test('legacy and freight address fields supported; invalid addresses skipped and rates never copied',async()=>{
  await order(1,{shippingAddress:null,freightAddress:{...address,postal_code:'33314-1234'},freightSnapshot:{request:{limitedAccess:true},result:{amountCents:12345}},createdAt:new Date('2026-01-01')});
  await order(1,{shippingAddress:{...address,country:'CA'},createdAt:new Date('2026-01-02')});
  expect((await get(1)).body).toEqual({address,limitedAccess:true});
  await m.Order.destroy({where:{}});
  await order(1,{shippingAddress:null,address_line_1:address.line1,address_line_2:address.line2,addressState:'FL',city:'Davie',zip_code:'33314',country:'US'});
  expect((await get(1)).body.address).toEqual(address);
 });
});
