const { Op } = require('sequelize');
const { sequelize } = require('../../db');
const {
  Product,
  Order,
  OrderProduct,
  CartProduct,
  CarpartsJob,
  CarpartsSyncState,
} = require('../../models/models');
const { bridge } = require('./transport');
const { availability } = require('./normalize');
function orderItems(input) {
  if (!Array.isArray(input) || !input.length || input.length > 100)
    throw Error('Invalid order items');
  const items = new Map();
  for (const item of input) {
    const id = Number(item.productId),
      n = Number(item.count);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(n) || n < 1 || n > 100)
      throw Error('Invalid product quantity');
    items.set(id, (items.get(id) || 0) + n);
  }
  return [...items].sort((a, b) => a[0] - b[0]).map(([productId, count]) => ({ productId, count }));
}
async function reserveOrder(data) {
  const items = orderItems(data.products);
  const sourced = await Product.findAll({
    where: { id: { [Op.in]: items.map(x => x.productId) }, source: 'carparts' },
    attributes: ['id', 'carpartsGuid', 'price'],
    raw: true,
  });
  let checkedAt = Date.now();
  if (sourced.length) {
    let response;
    // Only the read-only availability check is retried here. Native writes
    // are reconciled by the durable outbox with an order-specific audit.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await bridge(
          { action: 'stock', guids: sourced.map(p => p.carpartsGuid) },
          { timeout: 11000 },
        );
        break;
      } catch (error) {
        if (attempt === 1)
          throw Error('Inventory connection is temporarily unavailable. Please try again shortly.');
      }
    }
    if (!response.ok || !Array.isArray(response.items))
      throw Error('Inventory connection is temporarily unavailable');
    for (const p of sourced) {
      const row = response.items.find(r => r.GUID === p.carpartsGuid);
      if (!row || availability(row) !== 'available' || Number(row.PriceRetail) !== Number(p.price))
        throw Error(
          'This part has changed availability or price. Please refresh the catalog shortly.',
        );
    }
    checkedAt = Date.now();
  }
  return sequelize.transaction(async transaction => {
    const products = await Product.findAll({
      where: { id: { [Op.in]: items.map(x => x.productId) } },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (products.length !== items.length) throw Error('A product is no longer available');
    if (
      products.some(
        p =>
          p.source === 'carparts' &&
          !sourced.some(
            s =>
              s.id === p.id &&
              s.carpartsGuid === p.carpartsGuid &&
              Number(s.price) === Number(p.price),
          ),
      ) ||
      Date.now() - checkedAt > 30000
    )
      throw Error('Inventory changed during checkout. Please try again.');
    if (products.some(p => p.source === 'carparts')) {
      const state = await CarpartsSyncState.findByPk('catalog', { transaction });
      if (!state?.data?.finishedAt || Date.now() - Date.parse(state.data.finishedAt) > 15 * 60000)
        throw Error('Inventory connection is temporarily unavailable. Please try again shortly.');
    }
    let sum = 0;
    for (const p of products) {
      const n = items.find(x => x.productId === p.id).count;
      if (
        p.isDeleted ||
        p.adminHidden ||
        p.websiteSold ||
        p.count < n ||
        !(p.price > 0) ||
        p.source === 'legacy'
      )
        throw Error(`${p.name} is no longer available in this quantity`);
      if (p.source === 'carparts' && n !== 1) throw Error('This part is a single inventory item');
      sum += Math.round(p.price * 100) * n;
    }
    const now = new Date();
    const order = await Order.create(
      {
        userId: data.userId,
        fullName: data.fullName,
        mail: data.mail,
        phone: data.phone,
        delivey_type: data.delivey_type,
        state: 'pending',
        sum: sum / 100,
        stockReservedAt: now,
        reservationExpiresAt: new Date(now.getTime() + 35 * 60000),
      },
      { transaction },
    );
    await OrderProduct.bulkCreate(
      items.map(x => ({ ...x, orderId: order.id, selectorValue: '' })),
      { transaction },
    );
    for (const p of products)
      await p.update(
        { count: p.count - items.find(x => x.productId === p.id).count },
        { transaction },
      );
    return { order, products, items };
  });
}
async function releaseReservation(orderId, state = 'expired') {
  return sequelize.transaction(async transaction => {
    const order = await Order.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order || order.stockAppliedAt || order.stockReleasedAt || !order.stockReservedAt)
      return false;
    const items = await OrderProduct.findAll({
      where: { orderId },
      order: [['productId', 'ASC']],
      transaction,
    });
    for (const item of items) {
      const p = await Product.findByPk(item.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!p) continue;
      let count = p.count + item.count;
      if (p.source === 'carparts')
        count =
          p.websiteSold || p.sourceMissing || p.adminHidden
            ? 0
            : Math.min(p.sourceCount || 0, count);
      await p.update({ count }, { transaction });
    }
    await order.update({ stockReleasedAt: new Date(), state }, { transaction });
    return true;
  });
}
async function confirmPayment(
  orderId,
  { paymentIntentId, paidLive = false, paidAt = new Date(), updates = {} } = {},
) {
  return sequelize.transaction(async transaction => {
    const order = await Order.findByPk(orderId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!order) throw Error('Paid order not found');
    // Multiple Stripe event types and webhook retries must share one atomic stock operation.
    if (order.stockAppliedAt) {
      if (Object.keys(updates).length) await order.update(updates, { transaction });
      return { order, applied: false };
    }
    const items = await OrderProduct.findAll({
      where: { orderId },
      order: [['productId', 'ASC']],
      transaction,
    });
    if (!items.length) throw Error('Paid order has no items');
    for (const item of items) {
      const p = await Product.findByPk(item.productId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!p) throw Error('Paid product missing');
      if (!order.stockReservedAt || order.stockReleasedAt)
        await p.update({ count: Math.max(0, p.count - item.count) }, { transaction });
      if (p.source === 'carparts') {
        if (item.count !== 1) throw Error('Cannot remove multiple physical parts with one GUID');
        await p.update({ count: 0, websiteSold: true }, { transaction });
        if (paidLive) {
          const [job] = await CarpartsJob.findOrCreate({
            where: { guid: p.carpartsGuid },
            defaults: {
              orderId,
              productId: p.id,
              inventoryId: p.carpartsInventoryId,
              tag: p.carpartsTag,
            },
            transaction,
          });
          if (job.orderId !== orderId)
            throw Error('Part already assigned to another paid order; review required');
        }
      }
    }
    await order.update(
      {
        ...updates,
        state: 'confirmed',
        stockAppliedAt: new Date(),
        paidAt,
        paidLive,
        stripePaymentIntentId: paymentIntentId || order.stripePaymentIntentId,
      },
      { transaction },
    );
    await CartProduct.destroy({
      where: { userId: order.userId, productId: { [Op.in]: items.map(x => x.productId) } },
      transaction,
    });
    return { order, applied: true };
  });
}
module.exports = { orderItems, reserveOrder, releaseReservation, confirmPayment };
