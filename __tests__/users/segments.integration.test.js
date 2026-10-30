jest.mock('../../integrations/carparts/transport',()=>({bridge:jest.fn(()=>{throw Error('No Checkmate calls')})}));
jest.mock('../../utils/stripe',()=>({stripe:{},createCheckoutSession:jest.fn()}));
jest.mock('../../utils/mailer',()=>({sendOrderConfirmation:jest.fn(),sendOrderNotification:jest.fn()}));
const suite=process.env.CARPARTS_TEST_DB==='true'?describe:describe.skip;
suite('customer segmentation and private exports',()=>{
 let sequelize,m,app,request,tokens;
 const auth=(req,id=1)=>req.set('Authorization','Bearer '+tokens[id]);
 const list=query=>auth(request(app).get('/api/admin/user')).query(query||{});
 const exportFile=body=>auth(request(app).post('/api/admin/user/export')).send({format:'csv',fields:'contacts',selection:{allMatching:true},...body});
 beforeAll(async()=>{
  if(!/^carisma_sync_test_/.test(process.env.DB_NAME||''))throw Error('Isolated DB required');
  ({sequelize}=require('../../db'));m=require('../../models/models');await sequelize.sync({force:true});
  const migration=require('../../migrations/20261030020000-user-purchasing-category');
  await migration.down(sequelize.getQueryInterface());await migration.up(sequelize.getQueryInterface(),require('sequelize'));
  process.env.SECRET_KEY='segmentation-isolated-test';tokens={};for(const id of [1,2,3])tokens[id]=require('jsonwebtoken').sign({id,role:'ADMINISTRATOR'},process.env.SECRET_KEY);
  app=require('../../utils/server')();request=require('supertest');
 },30000);
 afterAll(async()=>sequelize.close());
 beforeEach(async()=>{
  await sequelize.query('TRUNCATE users,orders,products RESTART IDENTITY CASCADE');
  await m.User.bulkCreate([
   {id:1,mail:'admin@example.invalid',role:'ADMINISTRATOR',name:'Admin'},
   {id:2,mail:'buyer@example.invalid',name:'Buyer',purchasingAs:'Dealership',resaleTaxExempt:true,password:'never export',emailLoginCode:'never export'},
   {id:3,mail:'empty@example.invalid',name:'Empty',purchasingAs:'Residential'},
   {id:4,mail:'EMPTY@example.invalid',name:'=HYPERLINK("bad")',phone:'+12345',purchasingAs:'Assurance'},
   {id:5,mail:null,name:'Иван, "Иваныч"\nПетров'},
  ]);
  await m.Order.bulkCreate([
   {userId:2,state:'confirmed',sum:100,paidAt:new Date('2026-10-29T00:00:00Z')},
   {userId:2,state:'delivery',sum:50},
   ...['processing','pending','expired','canceled','refunded'].map(state=>({userId:2,state,sum:999})),
   {userId:2,state:'confirmed',sum:999,isIntegrationTest:true},
  ]);
  const product=await m.Product.create({name:'Test part',link:'test',images:[],price:10,count:10});
  await m.CartProduct.bulkCreate([{userId:2,productId:product.id,count:2},{userId:2,productId:product.id,count:3}]);
 });
 test('count and paid totals are not multiplied by joins; auth fields never leave listing',async()=>{
  const r=await list({limit:2});expect(r.status).toBe(200);expect(r.body.count).toBe(5);expect(r.body.rows).toHaveLength(2);
  const buyer=(await list({userId:2})).body.rows[0];expect(buyer.total).toBe(150);expect(buyer.paidOrdersCount).toBe(2);expect(buyer.cartSum).toBe(50);
  expect(JSON.stringify(buyer)).not.toMatch(/password|emailLoginCode|never export|recoveryCode|orders|cartProducts/);
 });
 test('search, customer category, purchasing cohort and resale filters combine',async()=>{
  const r=await list({search:'BUYER@',purchasingAs:'Dealership',purchases:'yes',resale:'yes'});expect(r.status).toBe(200);expect(r.body.rows.map(u=>u.id)).toEqual([2]);
  expect((await list({purchases:'no'})).body.count).toBe(4);
  expect((await list({purchasingAs:'unset'})).body.count).toBe(2);
  expect((await list({search:'%'})).body.count).toBe(0);
  expect((await list({userId:999})).body).toEqual({count:0,rows:[]});
 });
 test('sorting is stable across pages and numeric totals sort numerically',async()=>{
  const r=await list({sort:'total',direction:'desc',limit:1});expect(r.body.rows[0].id).toBe(2);
  const pages=await Promise.all([1,2,3].map(page=>list({sort:'id',direction:'asc',limit:2,page})));
  expect(pages.flatMap(r=>r.body.rows.map(u=>u.id))).toEqual([1,2,3,4,5]);
 });
 test('specific selections, all matches and exclusions apply to exports, not just page',async()=>{
  const chosen=await exportFile({selection:{ids:[2,5]}});expect(chosen.status).toBe(200);expect(chosen.headers['x-export-count']).toBe('2');expect(chosen.text).toContain('Иван');expect(chosen.text).not.toContain('admin@example');
  const all=await exportFile({filters:{purchases:'no',limit:1,page:2},selection:{allMatching:true,excludedIds:[1,5]}});expect(all.headers['x-export-count']).toBe('2');expect(all.text).not.toContain('buyer@example');
  const subset=await exportFile({filters:{purchasingAs:'Residential'},selection:{ids:[2,3]}});expect(subset.headers['x-export-count']).toBe('1');
 });
 test('email-only files deduplicate case-insensitively, skip missing emails and preserve privacy headers',async()=>{
  const r=await exportFile({fields:'emails'});expect(r.status).toBe(200);expect(r.headers['x-export-count']).toBe('3');
  expect(r.text.match(/empty@example.invalid/g)).toHaveLength(1);expect(r.text).not.toMatch(/Name|Phone|never export/);expect(r.headers['cache-control']).toContain('no-store');expect(r.headers['content-disposition']).toContain('.csv');
  expect((await exportFile({fields:'emails',selection:{ids:[5]}})).status).toBe(400);
 });
 test('real XLSX has typed numeric/date cells and formula-like strings stay literal',async()=>{
  const r=await exportFile({format:'xlsx',filters:{sort:'id',direction:'asc'}}).buffer(true).parse((res,done)=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>done(null,Buffer.concat(chunks)));});expect(r.status).toBe(200);expect(r.body.subarray(0,2).toString()).toBe('PK');
  const book=new (require('exceljs').Workbook)();await book.xlsx.load(r.body);const sheet=book.worksheets[0];
  expect(sheet.rowCount).toBe(6);expect(sheet.getCell('B5').value).toBe('=HYPERLINK("bad")');expect(sheet.getCell('I3').value).toBe(150);expect(sheet.getCell('K3').value).toBeInstanceOf(Date);expect(sheet.views[0].state).toBe('frozen');
 });
 test('admin category update is allowlisted; profile can set only own category, never tax/role/discount',async()=>{
  const r=await auth(request(app).put('/api/admin/user/3/category')).send({purchasingAs:'Dealership'});expect(r.status).toBe(200);
  expect((await auth(request(app).put('/api/admin/user/3/category')).send({purchasingAs:'Basic'})).status).toBe(400);
  expect((await auth(request(app).put('/api/admin/user/3/category')).send({purchasingAs:null,discount:100})).status).toBe(400);
  expect((await auth(request(app).put('/api/public/user'),3).send({purchasingAs:'Assurance',resaleTaxExempt:true,role:'ADMINISTRATOR',discount:100})).status).toBe(200);
  const u=await m.User.findByPk(3);expect(u.purchasingAs).toBe('Assurance');expect(u.category).toBe('Basic');expect(u.discount).toBe(0);expect(u.resaleTaxExempt).toBe(false);expect(u.role).toBe('USER');
  expect((await auth(request(app).put('/api/public/user'),3).send({purchasingAs:'invalid'})).status).toBe(400);
  expect((await auth(request(app).put('/api/admin/user/3/category')).send({purchasingAs:null})).status).toBe(200);
 });
 test('unauthenticated, non-admin and stale administrator tokens cannot read/export/update',async()=>{
  expect((await request(app).get('/api/admin/user')).status).toBe(401);
  expect((await auth(request(app).get('/api/admin/user'),2)).status).toBe(403);
  expect((await auth(request(app).post('/api/admin/user/export'),2).send({format:'csv'})).status).toBe(403);
  expect((await auth(request(app).put('/api/admin/user/3/category'),2).send({purchasingAs:'Assurance'})).status).toBe(403);
  await m.User.update({role:'USER'},{where:{id:1}});expect((await list()).status).toBe(403);
 });
 test('invalid filters, SQL fragments and empty selections fail closed',async()=>{
  for(const params of [{sort:'id;DROP TABLE users'},{limit:101},{page:-1},{purchasingAs:'invalid'},{purchases:'all'},{direction:'sideways'},{userId:'2 OR 1=1'}]) expect((await list(params)).status).toBe(400);
  for(const body of [{selection:null},{selection:{ids:[]}},{selection:{ids:['1 OR 1=1']}},{format:'html'},{selection:{allMatching:true,ids:[1]}},{selection:{allMatching:true,excludedIds:[-1]}}])expect((await exportFile(body)).status).toBe(400);
  expect(await m.User.count()).toBe(5);
 });
});
