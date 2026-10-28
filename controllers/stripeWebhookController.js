const { Order, OrderProduct, Product } = require('../models/models');
const { verifyWebhookSignature, getCheckoutSession, stripeForOrder } = require('../utils/stripe');
const { authorizedStripeTest } = require('../utils/stripeTest');
const { confirmPayment, releaseReservation } = require('../integrations/carparts/orders');
const { sendOrderConfirmation, sendOrderNotification } = require('../utils/mailer');

class StripeWebhookController {
  extractShippingAddressFromCheckoutSession(session) {
    // Stripe API (2025-03-31+) stores shipping details in collected_information.shipping_details.
    // Keep backward compatibility with older versions where shipping_details is at the top level.
    const shippingDetails =
      session?.collected_information?.shipping_details || session?.shipping_details || null;
    const address = shippingDetails?.address || session?.customer_details?.address || null;
    if (!address) {
      return null;
    }

    const deliveryInstructionsField = Array.isArray(session?.custom_fields)
      ? session.custom_fields.find(field => field?.key === 'delivery_instructions')
      : null;
    const deliveryInstructions = deliveryInstructionsField?.text?.value || null;

    return {
      country: address.country || null,
      city: address.city || null,
      zip_code: address.postal_code || null,
      addressState: address.state || null,
      address_line_1: address.line1 || null,
      address_line_2: address.line2 || null,
      ...(deliveryInstructions !== null ? { delivery_instructions: deliveryInstructions } : {}),
    };
  }

  async handleWebhook(req, res) {
    const signature = req.headers['stripe-signature'];
    const payload = req.body;

    let event;

    try {
      // Verify webhook signature
      event = verifyWebhookSignature(payload, signature);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (
      process.env.NODE_ENV === 'production' &&
      !event.livemode &&
      !authorizedStripeTest(event.data?.object?.metadata?.orderId)
    )
      return res.json({ received: true, ignored: 'test event' });
    try {
      const object = event.data.object;
      if (event.livemode === false && process.env.NODE_ENV === 'production') {
        const testOrder = await Order.findByPk(object.metadata?.orderId);
        if (!testOrder?.isIntegrationTest || testOrder.paidLive)
          return res.json({received:true,ignored:'not an integration test order'});
        // Only Checkout/payment events are used by the bounded operator tests.
        if (!['checkout.session.completed','checkout.session.async_payment_succeeded','payment_intent.succeeded',
          'checkout.session.expired','checkout.session.async_payment_failed'].includes(event.type))
          return res.json({received:true,ignored:'unsupported test event'});
      }
      switch (event.type) {
        case 'checkout.session.completed':
        case 'checkout.session.async_payment_succeeded':
          if (object.payment_status === 'paid') await this.confirmSession(object, event);
          break;
        case 'payment_intent.succeeded':
          if (object.metadata?.orderId) {
            const sessions = await stripeForOrder(object.metadata.orderId, event.livemode).checkout.sessions.list({
              payment_intent: object.id,
              limit: 1,
            });
            if (!sessions.data.length) throw Error('Paid checkout session not found');
            await this.confirmSession(sessions.data[0], event);
          }
          break;
        case 'checkout.session.expired':
          if (object.metadata?.orderId)
            await releaseReservation(object.metadata.orderId, 'expired');
          break;
        case 'checkout.session.async_payment_failed':
          if (object.metadata?.orderId)
            await releaseReservation(object.metadata.orderId, 'payment_failed');
          break;
        case 'charge.refunded':
          await this.handleChargeRefunded(object);
          break;
        case 'charge.dispute.created':
          await this.handleChargeDisputeCreated(object);
          break;
      }
      return res.json({ received: true });
    } catch (error) {
      console.error('Payment reconciliation failed:', error.message);
      return res.status(500).send('Webhook processing failed');
    }
  }

  async confirmSession(session, event) {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;
    const order = await Order.findByPk(orderId);
    if (!order) throw Error('Paid order not found');
    if (event.livemode === false && process.env.NODE_ENV === 'production' &&
        (!authorizedStripeTest(orderId) || !order.isIntegrationTest || order.paidLive))
      throw Error('Stripe test payment is not authorized');
    const full = await getCheckoutSession(session.id, {orderId, livemode:event.livemode});
    if (
      full.payment_status !== 'paid' ||
      full.currency !== 'usd' ||
      full.metadata?.orderId !== orderId ||
      full.livemode !== event.livemode ||
      Number(full.amount_subtotal) !== Math.round(Number(order.sum) * 100) ||
      (order.checkoutSessionId && order.checkoutSessionId !== full.id)
    )
      throw Error('Payment does not match the checkout order');
    // Only new orders carry an expected shipping amount; legacy payments keep
    // their original reconciliation behavior. A paid discrepancy is held for review.
    let shippingReview=null;
    if (order.shippingExpectedCents != null && Number(full.total_details?.amount_shipping || 0)!==order.shippingExpectedCents)
      shippingReview='The paid shipping amount does not match the checkout quote';
    if (order.freightQuoteId && (full.metadata?.freightQuoteId!==order.freightQuoteId ||
      (order.stripeCustomerId && full.customer!==order.stripeCustomerId)))
      shippingReview='The paid freight reference does not match the checkout order';
    if (order.parcelQuoteId && (full.metadata?.parcelQuoteId!==order.parcelQuoteId || order.parcelSnapshot?.request?.environment!=='production' || order.parcelSnapshot?.result?.virtual))
      shippingReview='The paid FedEx reference does not match the checkout order';
    if (order.shippingAddress && order.stripeCustomerId && full.customer!==order.stripeCustomerId)
      shippingReview='The payment customer does not match the delivery address';
    const updates = {
      checkoutSessionId: full.id,
      tax: (full.total_details?.amount_tax || 0) / 100,
      total: (full.amount_total || 0) / 100,
      shippingAmount: (full.total_details?.amount_shipping || 0) / 100,
      billingAddress: full.customer_details?.address || null,
      shippingAddress: order.shippingAddress || order.freightAddress || full.collected_information?.shipping_details?.address || full.shipping_details?.address || null,
      ...(shippingReview ? {shippingReview} : {}),
    };
    if (order.delivey_type === 'ups' && !order.shippingAddress)
      Object.assign(updates, this.extractShippingAddressFromCheckoutSession(full) || {});
    const result = await confirmPayment(orderId, {
      paymentIntentId: full.payment_intent,
      paidLive: event.livemode === true,
      paidAt: new Date(event.created * 1000),
      updates,
    });
    if (result.applied && !result.order.isIntegrationTest) await this.sendOrderConfirmationEmail(result.order);
  }

  /**
   * Send order confirmation email with product details
   */
  async sendOrderConfirmationEmail(order) {
    try {
      const orderProducts = await OrderProduct.findAll({
        where: { orderId: order.id },
        include: [{ model: Product, required: true }],
      });

      const products = orderProducts.map(op => ({
        name: op.product.name,
        count: op.count,
        price: op.unitPriceCents != null ? (op.unitPriceCents*op.count-(op.discountCents||0))/op.count/100 : op.product.price,
      }));

      const shippingAddress =
        ['ups','freight'].includes(order.delivey_type) && order.address_line_1
          ? {
              name: order.fullName,
              line1: order.address_line_1,
              line2: order.address_line_2,
              city: order.city,
              state: order.addressState,
              postal_code: order.zip_code,
              country: order.country || 'US',
            }
          : null;

      await sendOrderConfirmation({
        email: order.mail,
        orderId: order.id,
        fullName: order.fullName,
        products,
        subtotal: order.sum,
        shipping: Number(order.shippingAmount || 0),
        tax: order.tax || 0,
        total: order.total || order.sum,
        shippingAddress,
      });

      await sendOrderNotification({
        email: 'info@carismamp.com',
        orderId: order.id,
        fullName: order.fullName,
        products,
        subtotal: order.sum,
        shipping: Number(order.shippingAmount || 0),
        tax: order.tax || 0,
        total: order.total || order.sum,
        shippingAddress,
      });
    } catch (error) {
      console.error(`Error sending order confirmation email for order ${order.id}:`, error);
      // Don't throw - email failure shouldn't break the webhook
    }
  }

  async handleChargeRefunded(charge) {
    console.log('Charge refunded:', charge.id);
    const paymentIntentId = charge.payment_intent;

    if (!paymentIntentId) {
      return;
    }

    const order = await Order.findOne({ where: { stripePaymentIntentId: paymentIntentId } });
    if (order) {
      await order.update({ state: 'refunded' });
      console.log(`Order ${order.id} marked as refunded`);
    }
  }

  async handleChargeDisputeCreated(dispute) {
    console.log('Charge dispute created:', dispute.id);
    const paymentIntentId = dispute.payment_intent;

    if (!paymentIntentId) {
      return;
    }

    const order = await Order.findOne({ where: { stripePaymentIntentId: paymentIntentId } });
    if (order) {
      await order.update({ state: 'disputed' });
      console.log(`Order ${order.id} marked as disputed`);
    }
  }
}

module.exports = new StripeWebhookController();
