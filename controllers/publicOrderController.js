const { User } = require('../models/models');
const { createCheckoutSession } = require('../utils/stripe');
const checkout = require('../integrations/carparts/checkout');
const { reserveOrder, releaseReservation } = require('../integrations/carparts/orders');
class OrderController {
  async create(req, res) {
    let reserved, session;
    try {
      const result = await checkout.withCheckoutLock(req.user?.id, async()=>{
      const { fullName, mail, phone, delivey_type, products, freightQuoteId, freightDestination, freightAddress } = req.body;
      const userId = req.user?.id;
      const existing = await checkout.matchingOrder(userId, products);
      if (existing) return checkout.resume(userId,existing.order.id);
      if (!userId || !fullName || !phone || !mail || !Array.isArray(products) || !products.length)
        throw Error('Please fill in the order form');
      const user = await User.findByPk(userId);
      if (!user) throw Error('User not found. Please authorize');
      reserved = await reserveOrder({ userId, fullName, mail, phone, delivey_type, products,
        freightQuoteId, freightDestination, freightAddress });
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
        freight: order.freightQuoteId ? {quoteId:order.freightQuoteId,amountCents:order.shippingExpectedCents,
          address:order.freightAddress,name:order.fullName,phone:order.phone} : null,
      });
      await order.update({
        checkoutSessionId: session.sessionId,
        checkoutExpiresAt: session.expiresAt,
        stripePaymentIntentId: session.paymentIntentId || null,
        stripeCustomerId: session.customerId || null,
      });
      return {
        invoiceId: order.id,
        amount: order.sum,
        shippingAmount: Number(order.shippingAmount),
        currency: 'USD',
        paymentUrl: session.url,
        stripeSessionId: session.sessionId,
        paymentExpiresAt: session.expiresAt,
      };
      });
      return res.json(result);
    } catch (e) {
      // A timed-out Stripe request can still create a payable session. Keep the
      // reservation until reconciliation proves expiry; never release on ambiguity.
      if (reserved && e.type === 'StripeInvalidRequestError' && !session)
        await releaseReservation(reserved.order.id, 'payment_failed').catch(() => {});
      res.status(e.status || 400).json({message:e.message});
    }
  }
}
module.exports = new OrderController();
