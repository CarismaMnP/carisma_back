jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));
jest.mock('../../utils/stripe', () => ({ getCheckoutSession: jest.fn(), stripe: {} }));
jest.mock('../../utils/mailer', () => ({
  sendOrderConfirmation: jest.fn(),
  sendOrderNotification: jest.fn(),
}));
jest.mock('../../integrations/carparts/transport', () => ({
  bridge: jest.fn(() => {
    throw Error('External writes forbidden in tests');
  }),
}));
const suite = process.env.CARPARTS_TEST_DB === 'true' ? describe : describe.skip;
suite('Site price overrides and cart promotions', () => {
  let db, m, pricing, promos, orders, catalog;
  const guid = '11111111-1111-4111-8111-111111111111';
  const row = (price = 25) => ({
    GUID: guid,
    InventoryID: '9032||HOS||1||1',
    Tag: '00000123',
    Stock: '260009',
    Yard: 9032,
    Part: 'HOS',
    Available: 'Yes',
    Private: 'No',
    Status: ' ',
    PriceRetail: price,
    Description: 'Test hose',
  });
  const snapshot = (price = 25) => ({
    version: 1,
    complete: true,
    yard: '9032',
    beforeCount: 1,
    afterCount: 1,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    items: [row(price)],
    parts: [],
    vehicles: [],
    images: [],
    legacyLinks: [],
  });
  const manual = (name, price = 20, count = 5) =>
    m.Product.create({
      name,
      link: name,
      images: [],
      source: 'manual',
      isManual: true,
      price,
      count,
      ebayCategory: 'Test category',
    });
  const reserve = (products, promoCode) =>
    orders.reserveOrder({
      userId: 1,
      fullName: 'Test',
      mail: 'test@example.invalid',
      phone: '123',
      delivey_type: 'pickup',
      products,
      promoCode,
    });
  const edit = (ids, kind, value) =>
    pricing.preview(1, { selection: { mode: 'ids', ids }, operation: { kind, value } });
  const createPromo = (extra = {}) =>
    promos.save(null, {
      code: 'TESTCODE',
      kind: 'percent',
      value: '10',
      minSubtotal: '0',
      active: true,
      ...extra,
    });
  beforeAll(async () => {
    if (!/^carisma_sync_test_/.test(process.env.DB_NAME || ''))
      throw Error('Isolated test database required');
    ({ sequelize: db } = require('../../db'));
    m = require('../../models/models');
    pricing = require('../../integrations/pricing/products');
    promos = require('../../integrations/pricing/promos');
    orders = require('../../integrations/carparts/orders');
    catalog = require('../../integrations/carparts/catalog');
    await db.sync({ force: true });
    await m.User.create({ id: 1, mail: 'test@example.invalid' });
  }, 30000);
  beforeEach(async () => {
    await db.query(
      'TRUNCATE price_change_batches,promo_codes,carparts_jobs,"orderProducts",orders,products,carparts_images,carparts_sync_states RESTART IDENTITY CASCADE',
    );
    require('../../integrations/carparts/transport')
      .bridge.mockReset()
      .mockImplementation(async r => {
        if (r.action !== 'stock') throw Error('External writes forbidden');
        return { ok: true, items: [row()] };
      });
  });
  afterAll(async () => {
    if (db) await db.close();
  });
  test('source prices keep updating while website override survives sync and checkout', async () => {
    await catalog.syncCatalog({ snapshot: snapshot() });
    const p = await m.Product.findOne();
    const b = await edit([p.id], 'set', '19.99');
    await pricing.apply(1, b.id);
    await catalog.syncCatalog({ snapshot: snapshot(30) });
    await p.reload();
    expect([p.price, p.carpartsPriceCents, p.priceOverrideCents]).toEqual([19.99, 3000, 1999]);
    const r = await reserve([{ productId: p.id, count: 1 }]);
    expect(r.order.sum).toBe(19.99);
    const line = await m.OrderProduct.findOne();
    expect(line.productSnapshot).toMatchObject({ stock: '260009', tag: '00000123' });
    expect(p.additionalFields.localizedAspects).toEqual(
      expect.arrayContaining([
        { name: 'Stock number', value: '260009' },
        { name: 'Tag number', value: '00000123' },
      ]),
    );
    const reset = await edit([p.id], 'reset');
    await pricing.apply(1, reset.id);
    await p.reload();
    expect([p.price, p.priceOverrideCents]).toEqual([30, null]);
    await expect(reserve([{ productId: p.id, count: 1 }])).rejects.toThrow('availability or price');
  });
  test('filtered selection excludes unchecked rows and is frozen across pages and new imports', async () => {
    const a = await manual('A'),
      b = await manual('B'),
      c = await manual('C');
    await manual('Other').then(p => p.update({ ebayCategory: 'Other' }));
    const preview = await pricing.preview(1, {
      selection: {
        mode: 'filter',
        filters: { category: 'Test category', active: 'true', page: '2', limit: '1' },
        excludedIds: [b.id],
      },
      operation: { kind: 'decrease_percent', value: '10' },
    });
    const later = await manual('Later');
    expect(preview.count).toBe(2);
    await pricing.apply(1, preview.id);
    await pricing.apply(1, preview.id);
    expect(await Promise.all([a, b, c, later].map(async p => (await p.reload()).price))).toEqual([
      18, 20, 18, 20,
    ]);
  });
  test('stale preview, invalid resulting price and wrong owner change nothing', async () => {
    const a = await manual('A'),
      b = await manual('B');
    const preview = await edit([a.id, b.id], 'increase_amount', '1');
    await expect(pricing.apply(2, preview.id)).rejects.toThrow('not found');
    await b.update({ price: 21 });
    await expect(pricing.apply(1, preview.id)).rejects.toThrow('Nothing was saved');
    expect((await a.reload()).price).toBe(20);
    await expect(edit([a.id, b.id], 'decrease_amount', '30')).rejects.toThrow(
      'Invalid resulting price',
    );
    await expect(edit([a.id], 'set', '0')).rejects.toThrow();
    await expect(edit([a.id], 'decrease_percent', '100')).rejects.toThrow();
    await expect(edit([a.id], 'reset')).rejects.toThrow('Only Checkmate');
  });
  test('expired preview cannot apply and an overridden price cannot bypass unavailable stock', async () => {
    const p = await manual('A');
    const b = await edit([p.id], 'set', '12');
    await m.PriceChangeBatch.update({ expiresAt: new Date(0) }, { where: { id: b.id } });
    await expect(pricing.apply(1, b.id)).rejects.toThrow('expired');
    await catalog.syncCatalog({ snapshot: snapshot() });
    const cp = await m.Product.findOne({ where: { source: 'carparts' } });
    await pricing.apply(1, (await edit([cp.id], 'set', '17')).id);
    require('../../integrations/carparts/transport').bridge.mockResolvedValue({
      ok: true,
      items: [{ ...row(), Status: 'W' }],
    });
    await expect(reserve([{ productId: cp.id, count: 1 }])).rejects.toThrow('availability');
  });
  test('fixed discount allocation, multi-quantity Stripe totals and native sale price agree exactly', async () => {
    await catalog.syncCatalog({ snapshot: snapshot() });
    const cp = await m.Product.findOne();
    const manualProduct = await manual('Manual', 3.33, 3);
    await createPromo({ kind: 'fixed', value: '5.01' });
    const r = await reserve(
      [
        { productId: cp.id, count: 1 },
        { productId: manualProduct.id, count: 3 },
      ],
      'testcode',
    );
    expect(r.order.discountCents).toBe(501);
    expect(r.order.sum).toBe(29.98);
    const lines = await m.OrderProduct.findAll({ where: { orderId: r.order.id } });
    const stripeLines = lines.flatMap(x =>
      promos.stripeLines(
        r.products.find(p => p.id === x.productId),
        x,
      ),
    );
    expect(stripeLines.reduce((s, x) => s + x.price_data.unit_amount * x.quantity, 0)).toBe(2998);
    expect(stripeLines.every(x => x.price_data.unit_amount > 0)).toBe(true);
    const cpLine = lines.find(x => x.productId === cp.id);
    const payload = require('../../integrations/carparts/sale-payload').salePayload(
      { ...r.order.get(), paidAt: new Date() },
      lines,
      [
        {
          productId: cp.id,
          guid: cp.carpartsGuid,
          inventoryId: cp.carpartsInventoryId,
          tag: cp.carpartsTag,
        },
      ],
    );
    expect(payload.lines[0].priceCents).toBe(2500 - cpLine.discountCents);
    expect(payload.fulfillment).toBe('work_order');
    await pricing.apply(1, (await edit([cp.id], 'set', '11')).id);
    expect((await cpLine.reload()).unitPriceCents).toBe(2500);
  });
  test('promo quote reserves nothing, disabled/expired/minimum codes cannot reserve stock', async () => {
    const p = await manual('A');
    const promo = await createPromo({ minSubtotal: '30' });
    await expect(reserve([{ productId: p.id, count: 1 }], 'TESTCODE')).rejects.toThrow('at least');
    expect((await p.reload()).count).toBe(5);
    await promo.update({ minSubtotalCents: 0 });
    const q = await promos.quote({
      products: [{ productId: p.id, count: 1 }],
      promoCode: 'testcode',
    });
    expect(q.discountCents).toBe(200);
    expect(await m.Order.count()).toBe(0);
    await promo.update({ endsAt: new Date(0) });
    await expect(reserve([{ productId: p.id, count: 1 }], 'TESTCODE')).rejects.toThrow('expired');
    await promo.update({ endsAt: null, active: false });
    await expect(reserve([{ productId: p.id, count: 1 }], 'TESTCODE')).rejects.toThrow('invalid');
  });
  test('usage cap is serialized across concurrent checkouts and released only on cancel/expiry', async () => {
    const a = await manual('A'),
      b = await manual('B');
    await createPromo({ maxUses: 1 });
    const results = await Promise.allSettled([
      reserve([{ productId: a.id, count: 1 }], 'TESTCODE'),
      reserve([{ productId: b.id, count: 1 }], 'TESTCODE'),
    ]);
    expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    const first = results.find(x => x.status === 'fulfilled').value;
    const remaining = first.items[0].productId === a.id ? b : a;
    await orders.releaseReservation(first.order.id, 'expired');
    const second = await reserve([{ productId: remaining.id, count: 1 }], 'TESTCODE');
    expect(second.order.promoCode).toBe('TESTCODE');
  });
  test('large discount never makes a free physical line and all cents are accounted for', () => {
    const r = promos.allocate(
      [
        { unitPriceCents: 3, count: 2 },
        { unitPriceCents: 999, count: 1 },
      ],
      { kind: 'fixed', value: 999999, minSubtotalCents: 0 },
    );
    expect(r.subtotalCents).toBe(3);
    expect(r.lines.reduce((s, x) => s + x.discountCents, 0)).toBe(r.discountCents);
  });
  test('paid discounted webhook reconciles once and captures the discounted Work Order payload', async () => {
    await catalog.syncCatalog({ snapshot: snapshot() });
    const p = await m.Product.findOne();
    await createPromo();
    const { order } = await reserve([{ productId: p.id, count: 1 }], 'TESTCODE');
    await order.update({ checkoutSessionId: 'cs_fixture_discount' });
    const session = {
      id: 'cs_fixture_discount',
      metadata: { orderId: order.id },
      payment_status: 'paid',
      currency: 'usd',
      livemode: true,
      amount_subtotal: 2250,
      amount_total: 2250,
      total_details: { amount_tax: 0, amount_shipping: 0 },
      payment_intent: 'pi_fixture_discount',
    };
    require('../../utils/stripe').getCheckoutSession.mockResolvedValue(session);
    const webhook = require('../../controllers/stripeWebhookController');
    const event = { livemode: true, created: Math.floor(Date.now() / 1000) };
    await webhook.confirmSession(session, event);
    await webhook.confirmSession(session, event);
    const previousEnabled = process.env.CARPARTS_SALES_ENABLED,
      previousAfter = process.env.CARPARTS_SALES_AFTER;
    process.env.CARPARTS_SALES_ENABLED = 'true';
    process.env.CARPARTS_SALES_AFTER = '2020-01-01T00:00:00Z';
    const bridge = require('../../integrations/carparts/transport').bridge;
    bridge
      .mockReset()
      .mockImplementation(async payload => ({
        ok: true,
        state: 'work_order',
        orderId: payload.orderId,
        workOrder: '999',
        finalized: false,
        lineCount: 1,
        subtotalCents: 2250,
        taxCents: 0,
      }));
    try {
      await require('../../integrations/carparts/sales').processSales();
      await require('../../integrations/carparts/sales').processSales();
    } finally {
      if (previousEnabled === undefined) delete process.env.CARPARTS_SALES_ENABLED;
      else process.env.CARPARTS_SALES_ENABLED = previousEnabled;
      if (previousAfter === undefined) delete process.env.CARPARTS_SALES_AFTER;
      else process.env.CARPARTS_SALES_AFTER = previousAfter;
    }
    await order.reload();
    expect(order.state).toBe('confirmed');
    expect(order.discountCents).toBe(250);
    expect(order.checkmatePayload.lines[0].priceCents).toBe(2250);
    expect(order.checkmatePayload.fulfillment).toBe('work_order');
    expect(order.checkmateWorkOrder).toBe('999');
    expect(bridge).toHaveBeenCalledTimes(1);
    expect(await m.CarpartsJob.count({ where: { orderId: order.id } })).toBe(1);
    expect((await p.reload()).count).toBe(0);
  });
  test('price and promo endpoints reject non-admin writes; stock search uses the real stock number', async () => {
    await catalog.syncCatalog({ snapshot: snapshot() });
    const p = await m.Product.findOne();
    const request = require('supertest'),
      app = require('../../utils/server')();
    process.env.SECRET_KEY = 'isolated-pricing-test';
    const token = role => require('jsonwebtoken').sign({ id: 1, role }, process.env.SECRET_KEY);
    await request(app).post('/api/admin/product/prices/preview').send({}).expect(401);
    await request(app)
      .post('/api/admin/product/prices/preview')
      .set('Authorization', 'Bearer ' + token('USER'))
      .send({})
      .expect(403);
    await request(app)
      .post('/api/admin/promo-codes')
      .set('Authorization', 'Bearer ' + token('USER'))
      .send({})
      .expect(403);
    const response = await request(app)
      .get('/api/admin/product?search=260009')
      .set('Authorization', 'Bearer ' + token('ADMINISTRATOR'))
      .expect(200);
    expect(response.body.rows.map(x => x.id)).toEqual([p.id]);
    expect(await m.PriceChangeBatch.count()).toBe(0);
    expect(await m.PromoCode.count()).toBe(0);
  });
  test('schema migration upgrades populated old tables without changing prices', async () => {
    const p = await manual('A', 17.25);
    const q = db.getQueryInterface();
    const migration = require('../../migrations/20261025010000-site-pricing');
    await migration.down(q);
    await migration.up(q, require('sequelize'));
    expect((await p.reload()).price).toBe(17.25);
    expect(await m.PromoCode.count()).toBe(0);
  });
});
