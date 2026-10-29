const { User } = require('../models/models');
const { createCheckoutSession } = require('../utils/stripe');
const checkout = require('../integrations/carparts/checkout');
const { reserveOrder, releaseReservation } = require('../integrations/carparts/orders');
class OrderController {
  async create(req, res) {
    let reserved, session;
    try {
      const result = await checkout.withCheckoutLock(req.user?.id, async()=>{
      const { fullName, mail, phone, delivey_type, products, freightQuoteId, freightDestination, freightAddress, shippingAddress, parcelQuoteId, addressType, promoCode, resaleRequested, resaleTaxExemptExpected } = req.body;
      const userId = req.user?.id;
      const existing = await checkout.matchingOrder(userId, products);
      if (existing) {
        if (typeof resaleRequested==='boolean' && resaleRequested!==existing.order.resaleRequested)
          throw Object.assign(Error('These items have an unpaid order with a different resale selection. Cancel that order before changing its tax settings.'),{status:409});
        return checkout.resume(userId,existing.order.id);
      }
      if (!userId || !fullName || !phone || !mail || !Array.isArray(products) || !products.length)
        throw Error('Please fill in the order form');
      const user = await User.findByPk(userId);
      if (!user) throw Error('User not found. Please authorize');
      reserved = await reserveOrder({ userId, fullName, mail, phone, delivey_type, products,
        freightQuoteId, freightDestination, freightAddress, shippingAddress, parcelQuoteId, addressType, promoCode, resaleRequested, resaleTaxExemptExpected });
      const { order, items } = reserved;
      const lineItems = items.flatMap(item => require('../integrations/pricing/promos').stripeLines(reserved.products.find(p => p.id === item.productId),item));
      session = await createCheckoutSession({
        orderId: order.id,
        resaleTaxExempt: order.resaleTaxExempt,
        resaleApplicationId: order.resaleSnapshot?.applicationId,
        amount: order.sum,
        customerEmail: mail,
        lineItems,
        pickup: order.delivey_type === 'pickup' ? {name:order.fullName,phone:order.phone} : null,
        collectShippingAddress: delivey_type === 'ups' && !order.shippingAddress,
        shipping: order.shippingAddress ? {amountCents:order.shippingExpectedCents,address:order.shippingAddress,
          name:order.fullName,phone:order.phone,freightQuoteId:order.freightQuoteId,parcelQuoteId:order.parcelQuoteId,
          label:order.parcelQuoteId ? (order.freightQuoteId?'Freight + FedEx delivery':order.parcelSnapshot.result.selected.serviceName) : order.freightQuoteId?'Freight delivery · lift-gate & insurance':'Standard Shipping'} : null,
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
