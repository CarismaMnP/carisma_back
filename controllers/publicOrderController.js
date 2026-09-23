const ApiError = require('../error/ApiError');
const { User } = require('../models/models');
const { createCheckoutSession } = require('../utils/stripe');
const { reserveOrder, releaseReservation } = require('../integrations/carparts/orders');
class OrderController {
  async create(req, res, next) {
    let reserved, session;
    try {
      const { fullName, mail, phone, delivey_type, products } = req.body;
      const userId = req.user?.id;
      if (!userId || !fullName || !phone || !mail || !Array.isArray(products) || !products.length)
        return res.status(400).json({ error: 'Please fill in the order form' });
      const user = await User.findByPk(userId);
      if (!user) return res.status(400).json({ error: 'User not found. Please authorize' });
      reserved = await reserveOrder({ userId, fullName, mail, phone, delivey_type, products });
      const { order, items } = reserved;
      const lineItems = items.map(item => {
        const product = reserved.products.find(p => p.id === item.productId);
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.name,
              description: (product.about || product.name).slice(0, 500),
              tax_code: 'txcd_99999999',
            },
            unit_amount: Math.round(product.price * 100),
          },
          quantity: item.count,
        };
      });
      session = await createCheckoutSession({
        orderId: order.id,
        amount: order.sum,
        customerEmail: mail,
        lineItems,
        collectShippingAddress: delivey_type === 'ups',
      });
      await order.update({
        checkoutSessionId: session.sessionId,
        stripePaymentIntentId: session.paymentIntentId || null,
      });
      return res.json({
        invoiceId: order.id,
        amount: order.sum,
        currency: 'USD',
        paymentUrl: session.url,
        stripeSessionId: session.sessionId,
      });
    } catch (e) {
      // A timed-out Stripe request can still create a payable session. Keep the
      // reservation until reconciliation proves expiry; never release on ambiguity.
      if (reserved && e.type === 'StripeInvalidRequestError' && !session)
        await releaseReservation(reserved.order.id, 'payment_failed').catch(() => {});
      next(ApiError.badRequest(e.message));
    }
  }
}
module.exports = new OrderController();
