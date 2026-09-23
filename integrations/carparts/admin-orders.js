const { Order } = require('../../models/models');
const { stripe } = require('../../utils/stripe');
const { releaseReservation } = require('./orders');
async function updateAdminOrder(id, { state, sum }) {
  const order = await Order.findByPk(id);
  if (!order) throw Error('Order not found');
  if (order.stockReservedAt) {
    if (sum !== undefined && Number(sum) !== Number(order.sum))
      throw Error('The amount of a checkout order is fixed by its payment session');
    if (state !== order.state) {
      if (['canceled', 'expired', 'payment_failed'].includes(state) && !order.stockAppliedAt) {
        if (!order.checkoutSessionId)
          throw Error('Payment session is being reconciled. Please try again later.');
        let session = await stripe.checkout.sessions.retrieve(order.checkoutSessionId);
        if (session.status === 'open') session = await stripe.checkout.sessions.expire(session.id);
        if (session.payment_status === 'paid' || session.status !== 'expired')
          throw Error('Payment has completed or is still processing; cancellation requires review');
        await releaseReservation(id, 'canceled');
        return order.reload();
      }
      if (
        !order.stockAppliedAt ||
        !['confirmed', 'delivery', 'delivered', 'completed'].includes(state)
      )
        throw Error(
          'Payment and refund status is controlled by Stripe. Stock is never restored by a status edit.',
        );
    }
  }
  return order.update({
    ...(state !== undefined ? { state } : {}),
    ...(sum !== undefined ? { sum } : {}),
  });
}
module.exports = { updateAdminOrder };
