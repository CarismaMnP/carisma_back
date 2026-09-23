const { Op } = require('sequelize');
const { Order, Product, CarpartsJob, CarpartsSyncState } = require('../../models/models');
const { bridge } = require('./transport');
const { withLock } = require('./lock');
const { releaseReservation, confirmPayment } = require('./orders');
async function processSales() {
  if (process.env.CARPARTS_SALES_ENABLED !== 'true') return { disabled: true };
  const after = Date.parse(process.env.CARPARTS_SALES_AFTER || '');
  if (!Number.isFinite(after)) throw Error('Sales cutover time not configured');
  return withLock(9032003, async () => {
    const jobs = await CarpartsJob.findAll({
      where: {
        state: { [Op.in]: ['pending', 'retry', 'processing'] },
        nextAttemptAt: { [Op.lte]: new Date() },
      },
      order: [['createdAt', 'ASC']],
      limit: 10,
    });
    for (const job of jobs) {
      const [order, product] = await Promise.all([
        Order.findByPk(job.orderId),
        Product.findByPk(job.productId),
      ]);
      if (
        !order?.paidLive ||
        !order.stockAppliedAt ||
        !order.paidAt ||
        new Date(order.createdAt).getTime() < after ||
        new Date(order.paidAt).getTime() < after ||
        !['confirmed', 'delivery', 'delivered', 'completed'].includes(order.state) ||
        product?.source !== 'carparts' ||
        !product.websiteSold ||
        product.carpartsGuid !== job.guid
      ) {
        await job.update({
          state: 'review',
          lastError: 'Paid live order / cutover / inventory guard failed',
        });
        continue;
      }
      await job.update({
        state: 'processing',
        attempts: job.attempts + 1,
        nextAttemptAt: new Date(Date.now() + 3 * 60000),
      });
      try {
        const result = await bridge(
          {
            action: 'removeSale',
            guid: job.guid,
            inventoryId: job.inventoryId,
            tag: job.tag,
            orderId: job.orderId,
            paidLive: true,
            paidAt: new Date(order.paidAt).toISOString(),
          },
          { timeout: 90000 },
        );
        if (result.ok) {
          await job.update({ state: 'succeeded', result, lastError: null });
          await product.update({ count: 0, sourceCount: 0, sourceMissing: true });
        } else
          await job.update({
            state: 'review',
            result,
            lastError: `Checkmate requires review: ${result.state}`,
          });
      } catch (e) {
        await job.update({
          state: 'retry',
          lastError: e.message.slice(0, 2000),
          nextAttemptAt: new Date(
            Date.now() + Math.min(15 * 60000, 5000 * 2 ** Math.min(job.attempts, 8)),
          ),
        });
      }
    }
    await CarpartsSyncState.upsert({
      id: 'sales',
      data: { checkedAt: new Date().toISOString(), processed: jobs.length },
    });
    return { processed: jobs.length };
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
