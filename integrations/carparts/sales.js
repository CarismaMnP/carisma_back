const { Op } = require('sequelize');
const { sequelize } = require('../../db');
const { Order, OrderProduct, Product, CarpartsJob, CarpartsSyncState } = require('../../models/models');
const { bridge } = require('./transport');
const { withLock } = require('./lock');
const { releaseReservation } = require('./orders');
const { salePayload } = require('./sale-payload');
async function processSales({ testOrderId } = {}) {
  if (process.env.CARPARTS_SALES_ENABLED !== 'true') return { disabled: true };
  if (testOrderId && process.env.CARPARTS_TEST_ORDER_ID !== testOrderId)
    throw Error('Test order not authorized');
  const after = Date.parse(process.env.CARPARTS_SALES_AFTER || '');
  if (!Number.isFinite(after)) throw Error('Sales cutover time not configured');
  return withLock(9032003, async () => {
    const jobs = await CarpartsJob.findAll({
      where: { state: { [Op.in]: ['pending', 'retry', 'processing'] },
        nextAttemptAt: { [Op.lte]: new Date() }, ...(testOrderId ? {orderId: testOrderId} : {}) },
      include: [{model: Order, required: true, where: {isIntegrationTest: !!testOrderId}}],
      order: [['createdAt', 'ASC']], limit: 10,
    });
    let processed = 0;
    for (const orderId of [...new Set(jobs.map(j => j.orderId))]) {
      const order = await Order.findByPk(orderId);
      const group = await CarpartsJob.findAll({where: {orderId}, order: [['guid', 'ASC']]});
      if (group.some(j => ['review','succeeded'].includes(j.state))) {
        await CarpartsJob.update({state: 'review', lastError: 'Order contains completed or review jobs; inspect before continuing'},
          {where: {orderId, state: {[Op.in]: ['pending','retry','processing']}}});
        continue;
      }
      const products = await Product.findAll({where: {id: {[Op.in]: group.map(j => j.productId)}}});
      const testAllowed = testOrderId === orderId && order.isIntegrationTest && !order.paidLive;
      if (order.shippingReview || (!order.paidLive && !testAllowed) || !order.stockAppliedAt || !order.paidAt ||
          new Date(order.createdAt).getTime() < after || new Date(order.paidAt).getTime() < after ||
          !['confirmed','delivery','delivered','completed'].includes(order.state) ||
          group.some(j => !products.some(p => p.id === j.productId && p.source === 'carparts' &&
            p.websiteSold && p.carpartsGuid === j.guid))) {
        await CarpartsJob.update({state: 'review', lastError: 'Paid order / cutover / inventory guard failed'}, {where: {orderId}});
        continue;
      }
      try {
        if (!order.checkmatePayload) {
          const items = await OrderProduct.findAll({where: {orderId}});
          await order.update({checkmatePayload: salePayload(order, items, group)});
        }
      } catch (e) {
        await CarpartsJob.update({state: 'review', lastError: e.message}, {where: {orderId}});
        continue;
      }
      for (const job of group) await job.update({state:'processing', attempts:job.attempts + 1,
        nextAttemptAt: new Date(Date.now() + 5 * 60000)});
      processed += group.length;
      try {
        const result = await bridge(order.checkmatePayload, {timeout: 240000});
        if (result.ok && ['posted','already_posted'].includes(result.state) && result.invoice && result.workOrder &&
            result.orderId === orderId && result.taxCents === 0 &&
            result.subtotalCents === order.checkmatePayload.lines.reduce((n,l) => n + l.priceCents, 0)) {
          await sequelize.transaction(async transaction => {
            await order.update({checkmateWorkOrder: String(result.workOrder), checkmateInvoice: String(result.invoice)}, {transaction});
            await CarpartsJob.update({state:'succeeded', result, lastError:null}, {where:{orderId}, transaction});
            await Product.update({count:0, sourceCount:0, sourceMissing:false},
              {where:{id:{[Op.in]:group.map(j => j.productId)}}, transaction});
          });
        } else await CarpartsJob.update({state:'review', result,
          lastError: `Checkmate requires review: ${result.error || result.state || 'Invalid invoice result'}`}, {where:{orderId}});
      } catch (e) {
        // Retry the same immutable request. Windows reconciles durable checkpoints before any write.
        await CarpartsJob.update({state:'retry', lastError:e.message.slice(0,2000),
          nextAttemptAt:new Date(Date.now() + Math.min(15 * 60000, 5000 * 2 ** Math.min(group[0].attempts,8)))}, {where:{orderId}});
      }
    }
    if (!testOrderId) await CarpartsSyncState.upsert({id:'sales',data:{checkedAt:new Date().toISOString(),processed}});
    return {processed};
  });
}
async function reconcileReservations() {
  const { getCheckoutSession, stripe } = require('../../utils/stripe');
  const orders = await Order.findAll({
    where: {
      stockReservedAt: { [Op.ne]: null },
      stockAppliedAt: null,
      stockReleasedAt: null,
      reservationExpiresAt: { [Op.lt]: new Date() },
    },
    limit: 30,
  });
  for (const order of orders) {
    if (!order.checkoutSessionId) {
      // Recover a session whose creation succeeded but the response/DB save failed.
      let found = null;
      for await (const candidate of stripe.checkout.sessions.list({
        created: { gte: Math.floor(new Date(order.createdAt).getTime() / 1000) - 60 },
        limit: 100,
      })) {
        if (candidate.metadata?.orderId === order.id) {
          found = candidate;
          break;
        }
      }
      if (found) await order.update({ checkoutSessionId: found.id });
      else {
        if (Date.now() - new Date(order.createdAt).getTime() > 3600000)
          await releaseReservation(order.id, 'payment_failed');
        continue;
      }
    }
    const session = await getCheckoutSession(order.checkoutSessionId);
    if (session.payment_status === 'paid')
      await require('../../controllers/stripeWebhookController').confirmSession(session, {
        livemode: session.livemode,
        created: Math.floor(Date.now() / 1000),
      });
    else if (session.status === 'expired') await releaseReservation(order.id, 'expired');
  }
}
module.exports = { processSales, reconcileReservations };
