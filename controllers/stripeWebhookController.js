const { Order } = require('../models/models');
const { verifyWebhookSignature } = require('../utils/stripe');

class StripeWebhookController {
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

        console.log('Received Stripe webhook event:', event.type);

        try {
            // Handle the event
            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutSessionCompleted(event.data.object);
                    break;

                case 'checkout.session.async_payment_succeeded':
                    await this.handleCheckoutSessionAsyncPaymentSucceeded(event.data.object);
                    break;

                case 'checkout.session.async_payment_failed':
                    await this.handleCheckoutSessionAsyncPaymentFailed(event.data.object);
                    break;

                case 'checkout.session.expired':
                    await this.handleCheckoutSessionExpired(event.data.object);
                    break;

                case 'payment_intent.succeeded':
                    await this.handlePaymentIntentSucceeded(event.data.object);
                    break;

                case 'payment_intent.payment_failed':
                    await this.handlePaymentIntentFailed(event.data.object);
                    break;

                case 'payment_intent.canceled':
                    await this.handlePaymentIntentCanceled(event.data.object);
                    break;

                case 'payment_intent.created':
                    await this.handlePaymentIntentCreated(event.data.object);
                    break;

                case 'payment_intent.processing':
                    await this.handlePaymentIntentProcessing(event.data.object);
                    break;

                case 'charge.succeeded':
                    await this.handleChargeSucceeded(event.data.object);
                    break;

                case 'charge.failed':
                    await this.handleChargeFailed(event.data.object);
                    break;

                case 'charge.refunded':
                    await this.handleChargeRefunded(event.data.object);
                    break;

                case 'charge.dispute.created':
                    await this.handleChargeDisputeCreated(event.data.object);
                    break;

                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }

            res.json({ received: true });
        } catch (error) {
            console.error('Error processing webhook:', error);
            res.status(500).send('Webhook processing failed');
        }
    }

    async handleCheckoutSessionCompleted(session) {
        console.log('Checkout session completed:', session.id);
        const orderId = session.metadata?.orderId;

        if (!orderId) {
            console.error('No orderId in session metadata');
            return;
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            console.error('Order not found:', orderId);
            return;
        }

        // Update order state to confirmed if payment was successful immediately
        if (session.payment_status === 'paid') {
            await order.update({
                state: 'confirmed',
                stripePaymentIntentId: session.payment_intent
            });
            console.log(`Order ${orderId} confirmed - payment completed`);
        }
    }

    async handleCheckoutSessionAsyncPaymentSucceeded(session) {
        console.log('Checkout session async payment succeeded:', session.id);
        const orderId = session.metadata?.orderId;

        if (!orderId) {
            console.error('No orderId in session metadata');
            return;
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            console.error('Order not found:', orderId);
            return;
        }

        await order.update({
            state: 'confirmed',
            stripePaymentIntentId: session.payment_intent
        });
        console.log(`Order ${orderId} confirmed - async payment succeeded`);
    }

    async handleCheckoutSessionAsyncPaymentFailed(session) {
        console.log('Checkout session async payment failed:', session.id);
        const orderId = session.metadata?.orderId;

        if (!orderId) {
            console.error('No orderId in session metadata');
            return;
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            console.error('Order not found:', orderId);
            return;
        }

        await order.update({ state: 'payment_failed' });
        console.log(`Order ${orderId} marked as payment_failed`);
    }

    async handleCheckoutSessionExpired(session) {
        console.log('Checkout session expired:', session.id);
        const orderId = session.metadata?.orderId;

        if (!orderId) {
            console.error('No orderId in session metadata');
            return;
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            console.error('Order not found:', orderId);
            return;
        }

        await order.update({ state: 'expired' });
        console.log(`Order ${orderId} marked as expired`);
    }

    async handlePaymentIntentSucceeded(paymentIntent) {
        console.log('Payment intent succeeded:', paymentIntent.id);
        const orderId = paymentIntent.metadata?.orderId;

        if (!orderId) {
            console.error('No orderId in payment intent metadata');
            return;
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            console.error('Order not found:', orderId);
            return;
        }

        await order.update({
            state: 'confirmed',
            stripePaymentIntentId: paymentIntent.id
        });
        console.log(`Order ${orderId} confirmed via payment_intent.succeeded`);
    }

    async handlePaymentIntentFailed(paymentIntent) {
        console.log('Payment intent failed:', paymentIntent.id);
        const orderId = paymentIntent.metadata?.orderId;

        if (!orderId) {
            console.error('No orderId in payment intent metadata');
            return;
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            console.error('Order not found:', orderId);
            return;
        }

        await order.update({ state: 'payment_failed' });
        console.log(`Order ${orderId} marked as payment_failed`);
    }

    async handlePaymentIntentCanceled(paymentIntent) {
        console.log('Payment intent canceled:', paymentIntent.id);
        const orderId = paymentIntent.metadata?.orderId;

        if (!orderId) {
            console.error('No orderId in payment intent metadata');
            return;
        }

        const order = await Order.findByPk(orderId);
        if (!order) {
            console.error('Order not found:', orderId);
            return;
        }

        await order.update({ state: 'canceled' });
        console.log(`Order ${orderId} marked as canceled`);
    }

    async handlePaymentIntentCreated(paymentIntent) {
        console.log('Payment intent created:', paymentIntent.id);
        const orderId = paymentIntent.metadata?.orderId;

        if (!orderId) {
            return;
        }

        const order = await Order.findByPk(orderId);
        if (order) {
            await order.update({ stripePaymentIntentId: paymentIntent.id });
            console.log(`Order ${orderId} updated with payment intent ID`);
        }
    }

    async handlePaymentIntentProcessing(paymentIntent) {
        console.log('Payment intent processing:', paymentIntent.id);
        const orderId = paymentIntent.metadata?.orderId;

        if (!orderId) {
            return;
        }

        const order = await Order.findByPk(orderId);
        if (order && order.state === 'pending') {
            await order.update({ state: 'processing' });
            console.log(`Order ${orderId} marked as processing`);
        }
    }

    async handleChargeSucceeded(charge) {
        console.log('Charge succeeded:', charge.id);
        // Additional logic if needed
    }

    async handleChargeFailed(charge) {
        console.log('Charge failed:', charge.id);
        // Additional logic if needed
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
