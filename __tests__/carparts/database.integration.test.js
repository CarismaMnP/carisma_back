jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(async () => 'https://storage.example.invalid/image'),
}));
// Explicitly isolated PostgreSQL only. No bridge, Stripe or email calls in these tests.
jest.mock('../../integrations/carparts/transport', () => ({
  bridge: jest.fn(() => {
    throw Error('Live bridge forbidden in tests');
  }),
}));
const enabled = process.env.CARPARTS_TEST_DB === 'true';
const suite = enabled ? describe : describe.skip;
suite('CarParts transactional integration', () => {
  let sequelize, models, orders, catalog;
  const guid = '11111111-1111-4111-8111-111111111111';
  function snapshot(items) {
    return {
      version: 1,
      complete: true,
      yard: '9032',
      beforeCount: items.length,
      afterCount: items.length,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      items,
      parts: [],
      vehicles: [],
      images: [],
      legacyLinks: [],
    };
  }
  const row = (GUID = guid) => ({
    GUID,
    InventoryID: `9032||HOS||1||${GUID}`,
    Tag: '001',
    Yard: 9032,
    Part: 'HOS',
    Available: 'Yes',
    Private: 'No',
    Status: ' ',
    PriceRetail: 25,
    Description: 'Test hose',
    TimeStamp: '1,100',
  });
  beforeAll(async () => {
    if (!/^carisma_sync_test_/.test(process.env.DB_NAME || ''))
      throw Error('Refusing to reset a non-test database');
    ({ sequelize } = require('../../db'));
    models = require('../../models/models');
    orders = require('../../integrations/carparts/orders');
    catalog = require('../../integrations/carparts/catalog');
    await sequelize.sync({ force: true });
    await models.User.create({ id: 1, mail: 'test@example.invalid' });
  }, 30000);
  afterAll(async () => {
    if (sequelize) await sequelize.close();
  });
  beforeEach(async () => {
    await sequelize.query(
      'TRUNCATE carparts_jobs, "cartProducts", "orderProducts", orders, products, carparts_images, carparts_sync_states RESTART IDENTITY CASCADE',
    );
    require('../../integrations/carparts/transport').bridge.mockReset().mockImplementation(async request => {
      if (request.action !== 'stock') throw Error('Live bridge forbidden in tests');
      return { ok: true, items: request.guids.map(g => row(g)) };
    });
  });
  const reserve = (id, count = 1) =>
    orders.reserveOrder({
      userId: 1,
      fullName: 'Test',
      mail: 'test@example.invalid',
      phone: '000',
      delivey_type: 'pickup',
      products: [{ productId: id, count }],
    });
  test('imports only changes and leaves manual products untouched', async () => {
    const manual = await models.Product.create({
      name: 'Manual',
      link: 'manual',
      images: [],
      count: 9,
      price: 50,
      isManual: true,
      source: 'manual',
    });
    const first = await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    expect(first.created).toBe(1);
    const second = await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    expect(second.unchanged).toBe(1);
    expect((await manual.reload()).count).toBe(9);
  });
  test('retains original product ID and URL when replacing eBay source', async () => {
    const old = await models.Product.create({
      name: 'Old',
      link: 'existing-url',
      images: [],
      count: 1,
      price: 25,
      isManual: false,
      source: 'legacy',
      ebayLegacyId: '123',
    });
    const s = snapshot([row()]);
    s.legacyLinks = [{ GUID: guid, ItemID: '123' }];
    await catalog.syncCatalog({ snapshot: s });
    await old.reload();
    expect(old.carpartsGuid).toBe(guid);
    expect(old.link).toBe('existing-url');
    expect(await models.Product.count()).toBe(1);
  });
  test('concurrent checkout cannot reserve one part twice', async () => {
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    const p = await models.Product.findOne({ where: { carpartsGuid: guid } });
    const results = await Promise.allSettled([reserve(p.id), reserve(p.id)]);
    expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect((await p.reload()).count).toBe(0);
  });
  test('duplicate payment events create one job; import never resurrects a paid part', async () => {
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    const p = await models.Product.findOne({ where: { carpartsGuid: guid } });
    const { order } = await reserve(p.id);
    const results = await Promise.all([
      orders.confirmPayment(order.id, { paidLive: true }),
      orders.confirmPayment(order.id, { paidLive: true }),
    ]);
    expect(results.filter(x => x.applied)).toHaveLength(1);
    expect(await models.CarpartsJob.count()).toBe(1);
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    expect((await p.reload()).count).toBe(0);
    expect(await orders.releaseReservation(order.id)).toBe(false);
  });
  test('manual stock is debited once and never creates a native deletion job', async () => {
    const p = await models.Product.create({
      name: 'Manual',
      link: 'manual',
      images: [],
      count: 9,
      price: 50,
      isManual: true,
      source: 'manual',
    });
    const { order } = await reserve(p.id, 2);
    await orders.confirmPayment(order.id, { paidLive: true });
    await orders.confirmPayment(order.id, { paidLive: true });
    expect((await p.reload()).count).toBe(7);
    expect(await models.CarpartsJob.count()).toBe(0);
  });
  test('unpaid reservation releases once; source unavailability is preserved', async () => {
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    const p = await models.Product.findOne({ where: { carpartsGuid: guid } });
    const { order } = await reserve(p.id);
    await catalog.syncCatalog({ snapshot: snapshot([{ ...row(), Status: 'S' }]) });
    expect(await orders.releaseReservation(order.id)).toBe(true);
    expect(await orders.releaseReservation(order.id)).toBe(false);
    expect((await p.reload()).count).toBe(0);
  });
  test('full snapshot retires a missing source record; failed snapshot does not', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      row(`${i + 1}1111111-1111-4111-8111-111111111111`),
    );
    await catalog.syncCatalog({ snapshot: snapshot(rows) });
    const bad = snapshot(rows.slice(1));
    bad.complete = false;
    await expect(catalog.syncCatalog({ snapshot: bad })).rejects.toThrow();
    expect(await models.Product.count({ where: { count: 1 } })).toBe(5);
    await catalog.syncCatalog({ snapshot: snapshot(rows.slice(1)) });
    expect(await models.Product.count({ where: { count: 1 } })).toBe(4);
  });
  test('test-mode payment cannot create a Checkmate sale job', async () => {
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    const p = await models.Product.findOne({ where: { carpartsGuid: guid } });
    const { order } = await reserve(p.id);
    await orders.confirmPayment(order.id, { paidLive: false });
    expect(await models.CarpartsJob.count()).toBe(0);
  });
  test('a committed sale blocks checkout immediately and disappears on reconciliation', async () => {
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    const p = await models.Product.findOne({ where: { carpartsGuid: guid } });
    const sold = { ...row(), EbayStatus: 'C', DisplayStatus: 'C' };
    require('../../integrations/carparts/transport').bridge.mockResolvedValue({ ok: true, items: [sold] });
    await expect(reserve(p.id)).rejects.toThrow('changed availability or price');
    expect(await models.Order.count()).toBe(0);
    expect(await models.CarpartsJob.count()).toBe(0);
    await catalog.syncCatalog({ snapshot: snapshot([sold]) });
    expect((await p.reload()).count).toBe(0);
    expect(p.carpartsData.reason).toBe('committed');
    expect(await models.CarpartsJob.count()).toBe(0);
  });
  test('a disconnected source cannot reserve stock or create an order', async () => {
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    const p = await models.Product.findOne({ where: { carpartsGuid: guid } });
    require('../../integrations/carparts/transport').bridge.mockRejectedValue(
      Error('Source offline'),
    );
    await expect(reserve(p.id)).rejects.toThrow('Inventory connection is temporarily unavailable');
    expect(await models.Order.count()).toBe(0);
    expect((await p.reload()).count).toBe(1);
  });
  test('a brief read-only connection failure recovers before reserving stock once', async () => {
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    const p = await models.Product.findOne({ where: { carpartsGuid: guid } });
    const bridge = require('../../integrations/carparts/transport').bridge;
    bridge.mockClear();
    bridge.mockRejectedValueOnce(Error('Temporary SSH connection failure'));
    await reserve(p.id);
    expect(bridge).toHaveBeenCalledTimes(2);
    expect(await models.Order.count()).toBe(1);
    expect((await p.reload()).count).toBe(0);
    expect(await models.CarpartsJob.count()).toBe(0);
  });
  test('a transient native timeout is retried for the same paid order only', async () => {
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    const p = await models.Product.findOne({ where: { carpartsGuid: guid } });
    const { order } = await reserve(p.id);
    await orders.confirmPayment(order.id, { paidLive: true });
    process.env.CARPARTS_SALES_ENABLED = 'true';
    process.env.CARPARTS_SALES_AFTER = '2026-01-01T00:00:00Z';
    const bridge = require('../../integrations/carparts/transport').bridge;
    bridge.mockReset();
    bridge
      .mockRejectedValueOnce(Error('Disconnected after request'))
      .mockResolvedValueOnce({ok:true,state:'already_posted',orderId:order.id,workOrder:'900',invoice:'800',taxCents:0,subtotalCents:2500});
    const { processSales } = require('../../integrations/carparts/sales');
    await processSales();
    const job = await models.CarpartsJob.findOne();
    expect(job.state).toBe('retry');
    await job.update({ nextAttemptAt: new Date(0) });
    await processSales();
    await processSales();
    expect((await job.reload()).state).toBe('succeeded');
    expect(bridge).toHaveBeenCalledTimes(2);
    expect(bridge.mock.calls[0][0].orderId).toBe(order.id);
    expect(bridge.mock.calls[1][0].orderId).toBe(order.id);
  });
  test('historical orders cannot trigger a native sale after cutover', async () => {
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    const p = await models.Product.findOne({ where: { carpartsGuid: guid } });
    const { order } = await reserve(p.id);
    await orders.confirmPayment(order.id, { paidLive: true });
    process.env.CARPARTS_SALES_ENABLED = 'true';
    process.env.CARPARTS_SALES_AFTER = new Date(Date.now() + 60000).toISOString();
    const bridge = require('../../integrations/carparts/transport').bridge;
    bridge.mockClear();
    await require('../../integrations/carparts/sales').processSales();
    expect(bridge).not.toHaveBeenCalled();
    expect((await models.CarpartsJob.findOne()).state).toBe('review');
  });
  test('an external sale becomes a review task and is not deleted again', async () => {
    await catalog.syncCatalog({ snapshot: snapshot([row()]) });
    const p = await models.Product.findOne({ where: { carpartsGuid: guid } });
    const { order } = await reserve(p.id);
    await orders.confirmPayment(order.id, { paidLive: true });
    process.env.CARPARTS_SALES_ENABLED = 'true';
    process.env.CARPARTS_SALES_AFTER = '2026-01-01T00:00:00Z';
    const bridge = require('../../integrations/carparts/transport').bridge;
    bridge.mockReset();
    bridge.mockResolvedValue({ ok: false, state: 'unavailable', writeCalled: false });
    const { processSales } = require('../../integrations/carparts/sales');
    await processSales();
    await processSales();
    expect(bridge).toHaveBeenCalledTimes(1);
    expect((await models.CarpartsJob.findOne()).state).toBe('review');
    expect((await p.reload()).count).toBe(0);
  });

  test('migration preserves the active relisting and retires older aliases', async () => {
    const inactive = await models.Product.create({
      name: 'Old',
      link: 'old-url',
      images: [],
      count: 0,
      price: 25,
      isManual: false,
      source: 'legacy',
      ebayLegacyId: '111',
    });
    const active = await models.Product.create({
      name: 'Current',
      link: 'current-url',
      images: [],
      count: 1,
      price: 25,
      isManual: false,
      source: 'legacy',
      ebayLegacyId: '222',
    });
    const s = snapshot([row()]);
    s.legacyLinks = [
      { GUID: guid, ItemID: '111' },
      { GUID: guid, ItemID: '222' },
    ];
    await catalog.syncCatalog({ snapshot: s });
    expect((await active.reload()).carpartsGuid).toBe(guid);
    expect(active.link).toBe('current-url');
    expect((await inactive.reload()).count).toBe(0);
    expect(inactive.carpartsGuid).toBeNull();
  });
  test('a historical Checkmate identity retires a missing part at cutover without touching an unmapped card', async () => {
    const gone = await models.Product.create({
      name: 'Gone',
      link: 'gone',
      images: [],
      count: 1,
      price: 25,
      isManual: false,
      source: 'legacy',
      ebayLegacyId: 'gone',
    });
    const unknown = await models.Product.create({
      name: 'Unknown',
      link: 'unknown',
      images: [],
      count: 1,
      price: 25,
      isManual: false,
      source: 'legacy',
      ebayLegacyId: 'unknown',
    });
    const other = '22222222-2222-4222-8222-222222222222';
    const s = snapshot([row(other)]);
    s.legacyLinks = [{ GUID: guid, ItemID: 'gone' }];
    await catalog.syncCatalog({ snapshot: s });
    expect((await gone.reload()).count).toBe(0);
    expect(gone.sourceMissing).toBe(true);
    expect(gone.carpartsGuid).toBe(guid);
    expect((await unknown.reload()).count).toBe(1);
  });
  test.each(['legacy','private'])('a public direct link cannot expose %s inventory', async kind => {
    const product = await models.Product.create({name:'Hidden stock',link:'hidden-stock',source:kind==='legacy'?'legacy':'carparts',carpartsData:{reason:kind},isManual:false,count:0,price:25,images:[]});
    const response = {status:jest.fn().mockReturnThis(),json:jest.fn()};
    const next = jest.fn();
    await require('../../controllers/clientProductController').getProduct({query:{link:product.link},params:{}},response,next);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({message:'Product not found'});
    expect(next).not.toHaveBeenCalled();
  });
  test('an archived imported alias cannot be reactivated by editing its quantity', async () => {
    const product = await models.Product.create({name:'Archived alias',link:'archived-alias',source:'legacy',isManual:false,count:0,price:25,images:[]});
    const response = {status:jest.fn().mockReturnThis(),json:jest.fn()};
    const next = jest.fn();
    await require('../../controllers/adminProductController').update({query:{id:product.id},body:{data:JSON.stringify({count:1})}},response,next);
    expect(response.status).toHaveBeenCalledWith(409);
    expect(next).not.toHaveBeenCalled();
    expect((await product.reload()).count).toBe(0);
    expect(product.source).toBe('legacy');
  });
  test('a new card shows its primary photo while the remaining album transfers', async () => {
    const source = snapshot([row()]);
    source.images = [1,2].map(n => ({GUID:guid,ImageNumber:n,PrimaryImage:1,ImageLocation:`P:\\2026\\test\\photo${n}.jpg`,CheckSum:`sum${n}`,WebCheckSum:`web${n}`}));
    await catalog.syncCatalog({snapshot:source});
    const p = await models.Product.findOne({where:{carpartsGuid:guid}});
    const photos = p.carpartsData.photos;
    await models.CarpartsImage.update({url:'https://storage.example.invalid/primary.jpg'}, {where:{id:photos[0].id}});
    await catalog.publishReadyImages();
    expect((await p.reload()).images).toEqual(['https://storage.example.invalid/primary.jpg']);
    expect(p.imagesHash).toBeNull();
    await models.CarpartsImage.update({url:'https://storage.example.invalid/second.jpg'}, {where:{id:photos[1].id}});
    await catalog.publishReadyImages();
    expect((await p.reload()).images).toEqual(['https://storage.example.invalid/primary.jpg','https://storage.example.invalid/second.jpg']);
    expect(p.imagesHash).toBeTruthy();
  });
  test('image receipts persist atomically, including retryable failures', async () => {
    process.env.CARPARTS_IMAGE_DIRECT = 'true';
    const { CarpartsImage } = models;
    const good = await CarpartsImage.create({
      id: '0'.repeat(64),
      guid,
      source: { id: '0'.repeat(64), GUID: guid },
    });
    const bad = await CarpartsImage.create({
      id: '1'.repeat(64),
      guid,
      source: { id: '1'.repeat(64), GUID: guid },
    });
    require('../../integrations/carparts/transport').bridge.mockResolvedValue({
      ok: true,
      images: [
        { id: good.id, sha256: 'a'.repeat(64), bytes: 100 },
        { id: bad.id, error: 'Temporary upload failure' },
      ],
    });
    const result = await require('../../integrations/carparts/images').transferImages(0);
    expect(result.copied).toBe(1);
    expect(result.errors).toBe(1);
    expect((await good.reload()).url).toContain(good.id);
    expect((await bad.reload()).attempts).toBe(1);
    expect(bad.url).toBeNull();
  });
  test('an image retired during upload cannot be recreated by an old receipt', async () => {
    process.env.CARPARTS_IMAGE_DIRECT = 'true';
    const { CarpartsImage } = models;
    const image = await CarpartsImage.create({
      id: '0'.repeat(64),
      guid,
      source: { id: '0'.repeat(64), GUID: guid },
    });
    require('../../integrations/carparts/transport').bridge.mockImplementation(async () => {
      await image.destroy();
      return { ok: true, images: [{ id: image.id, sha256: 'a'.repeat(64), bytes: 100 }] };
    });
    await require('../../integrations/carparts/images').transferImages(0);
    expect(await CarpartsImage.count()).toBe(0);
  });
  test('native sales group multiple physical parts, retain checkout prices and preserve manual inventory', async () => {
    process.env.CARPARTS_SALES_ENABLED = 'true';process.env.CARPARTS_SALES_AFTER = '2020-01-01T00:00:00Z';
    const g2='22222222-2222-4222-8222-222222222222';
    await catalog.syncCatalog({snapshot:snapshot([row(),row(g2)])});
    const ps=await models.Product.findAll({order:[['id','ASC']]});
    const manual=await models.Product.create({name:'Manual',link:'manual',images:[],source:'manual',count:3,price:7});
    const {order}=await orders.reserveOrder({userId:1,delivey_type:'pickup',fullName:'Buyer',mail:'test@example.invalid',products:[...ps.map(p=>({productId:p.id,count:1})),{productId:manual.id,count:2}]});
    await orders.confirmPayment(order.id,{paidLive:true,updates:{tax:4.8,total:68.8,billingAddress:{line1:'Invoice street'},shippingAddress:{line1:'Delivery street'}}});
    await ps[0].update({price:999});
    const bridge=require('../../integrations/carparts/transport').bridge;
    bridge.mockImplementation(async payload => ({ok:true,state:'posted',orderId:payload.orderId,workOrder:'900',invoice:'800',taxCents:0,subtotalCents:5000}));
    const {processSales}=require('../../integrations/carparts/sales');
    expect((await processSales()).processed).toBe(2);
    const payload=bridge.mock.calls.at(-1)[0];expect(payload.action).toBe('createSale');expect(payload.lines).toHaveLength(2);
    expect(payload.lines.map(l=>l.priceCents)).toEqual([2500,2500]);expect(payload.customer.shipping.line1).toBe('Delivery street');
    expect(payload.websiteTaxCents).toBe(480);expect(payload.taxMode).toBe('not_taxable');
    expect((await order.reload()).checkmateInvoice).toBe('800');
    expect(await models.CarpartsJob.count({where:{state:'succeeded'}})).toBe(2);
    expect((await ps[0].reload()).sourceMissing).toBe(false);expect((await manual.reload()).count).toBe(1);
    expect((await processSales()).processed).toBe(0);expect(bridge.mock.calls.filter(c=>c[0].action==='createSale')).toHaveLength(1);
  });
  test('lost response retries immutable request; uncertain native result is held without another automatic attempt', async () => {
    process.env.CARPARTS_SALES_ENABLED='true';process.env.CARPARTS_SALES_AFTER='2020-01-01T00:00:00Z';
    await catalog.syncCatalog({snapshot:snapshot([row()])});const p=await models.Product.findOne();
    const {order}=await reserve(p.id);await orders.confirmPayment(order.id,{paidLive:true});
    const bridge=require('../../integrations/carparts/transport').bridge;
    bridge.mockRejectedValueOnce(Error('connection lost'));
    const {processSales}=require('../../integrations/carparts/sales');await processSales();
    const first=bridge.mock.calls.at(-1)[0];await order.update({fullName:'Later edit'});
    await models.CarpartsJob.update({nextAttemptAt:new Date(0)},{where:{orderId:order.id}});
    bridge.mockResolvedValueOnce({ok:false,state:'review_required',error:'Uncertain native call'});await processSales();
    expect(bridge.mock.calls.at(-1)[0]).toEqual(first);expect((await models.CarpartsJob.findOne()).state).toBe('review');
    expect((await processSales()).processed).toBe(0);
  });
  test('normal worker excludes authorized test orders; only explicit test process can post them', async () => {
    process.env.CARPARTS_SALES_ENABLED='true';process.env.CARPARTS_SALES_AFTER='2020-01-01T00:00:00Z';
    await catalog.syncCatalog({snapshot:snapshot([row()])});const p=await models.Product.findOne();
    const testId=require('crypto').randomUUID();
    await expect(orders.reserveOrder({products:[{productId:p.id,count:1}]},{authorizedTestId:testId})).rejects.toThrow('authorized');
    process.env.CARPARTS_TEST_ORDER_ID=testId;
    const {order}=await orders.reserveOrder({userId:1,delivey_type:'pickup',fullName:'TEST',mail:'test@example.invalid',products:[{productId:p.id,count:1}]},{authorizedTestId:testId});
    await orders.confirmPayment(order.id,{paidLive:false});
    const {processSales}=require('../../integrations/carparts/sales');expect((await processSales()).processed).toBe(0);
    expect((await models.CarpartsJob.findOne()).state).toBe('pending');
    const bridge=require('../../integrations/carparts/transport').bridge;
    bridge.mockImplementation(async payload=>({ok:true,state:'posted',orderId:payload.orderId,workOrder:'901',invoice:'801',taxCents:0,subtotalCents:2500}));
    expect((await processSales({testOrderId:testId})).processed).toBe(1);expect((await order.reload()).paidLive).toBe(false);
    delete process.env.CARPARTS_TEST_ORDER_ID;
  });
  test('profile name fills only blank matching account, never overwrites an existing name', async () => {
    const {fillMissingCustomerName}=require('../../utils/customerName');
    const u=await models.User.findByPk(1);await u.update({name:'   '});
    await fillMissingCustomerName({userId:1,mail:' TEST@EXAMPLE.INVALID ',fullName:'  New   Buyer '});
    expect((await u.reload()).name).toBe('New Buyer');
    await fillMissingCustomerName({userId:1,mail:u.mail,fullName:'Replacement'});expect((await u.reload()).name).toBe('New Buyer');
    await u.update({name:''});await fillMissingCustomerName({userId:1,mail:'other@example.invalid',fullName:'Other'});expect((await u.reload()).name).toBe('');
  });
  test('product filters include hidden/out of stock rows and use case insensitive literal search', async () => {
    const {filters}=require('../../utils/adminProductFilters');
    await models.Product.bulkCreate([
      {name:'Audi Part',link:'a',images:[],make:'Audi',ebayModel:'Q5',price:10,count:1},
      {name:'Audi Sold',link:'b',images:[],make:'Audi',ebayModel:'Q5',price:20,count:0},
      {name:'Hidden',link:'c',images:[],price:2,count:1,isDeleted:true},
      {name:'Percent%part',link:'d',images:[],price:5,count:1},
    ]);
    let f=filters({active:'true',inactive:'true',make:'Audi',sort:'price_desc',minPrice:'10',maxPrice:'20'});
    expect((await models.Product.findAll({where:f.where,order:f.order})).map(p=>p.name)).toEqual(['Audi Sold','Audi Part']);
    f=filters({active:'false',inactive:'true'});expect(await models.Product.count({where:f.where})).toBe(2);
    f=filters({search:'%'});expect(await models.Product.count({where:f.where})).toBe(1);
  });

  test('additive migration backfills latest matching paid customer name and preserves existing names', async () => {
    const u=await models.User.findByPk(1);await u.update({name:' '});
    const other=await models.User.create({id:2,mail:'retained@example.invalid',name:'Chosen name'});
    await models.Order.create({userId:1,fullName:'  Elizabeth   Example  ',mail:u.mail,state:'confirmed',sum:10});
    await models.Order.create({userId:other.id,fullName:'Overwrite',mail:other.mail,state:'confirmed',sum:10});
    const q=sequelize.getQueryInterface();
    for(const field of ['isIntegrationTest','shippingAmount','billingAddress','shippingAddress','checkmatePayload','checkmateWorkOrder','checkmateInvoice']) await q.removeColumn('orders',field);
    for(const field of ['unitPriceCents','productSnapshot']) await q.removeColumn('orderProducts',field);
    await require('../../migrations/20261012010000-checkmate-invoices').up(q,require('sequelize'));
    expect((await u.reload()).name).toBe('Elizabeth Example');expect((await other.reload()).name).toBe('Chosen name');
  });

});
