const { Order, CartProduct, OrderProduct, Product } = require('../models/models');
const { verifyWebhookSignature, getCheckoutSession } = require('../utils/stripe');

class StripeWebhookController {
    /**
     * Reduce product count after successful order payment
     * For eBay products (isManual = false), set count to 0
     * For manual products (isManual = true), decrease count by ordered amount
     */
    async decreaseProductStock(orderId) {
        try {
            // Get all products from the order
            const orderProducts = await OrderProduct.findAll({
                where: { orderId },
                include: [{ model: Product, required: true }]
            });

            for (const orderProduct of orderProducts) {
                const product = orderProduct.product;
                const orderedCount = orderProduct.count;

                if (!product) {
                    console.error(`Product not found for OrderProduct ${orderProduct.id}`);
                    continue;
                }

                if (product.isManual === false) {
                    // eBay товар - обнуляем count
                    await product.update({ count: 0 });
                    console.log(`eBay product ${product.id} (${product.name}) - set count to 0`);
                } else {
                    // Ручной товар - уменьшаем count на количество в заказе
                    const newCount = Math.max(0, product.count - orderedCount);
                    await product.update({ count: newCount });
                    console.log(`Manual product ${product.id} (${product.name}) - decreased count from ${product.count} to ${newCount}`);
                }
            }

            console.log(`Stock decreased for order ${orderId}`);
        } catch (error) {
            console.error(`Error decreasing stock for order ${orderId}:`, error);
            throw error;
        }
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

        // Retrieve full session details to get tax information
        const fullSession = await getCheckoutSession(session.id);

        // Extract tax and total information
        const tax = fullSession.total_details?.amount_tax || 0;
        const total = fullSession.amount_total || 0;

        // Update order state to confirmed if payment was successful immediately
        if (session.payment_status === 'paid') {
            await order.update({
                state: 'confirmed',
                stripePaymentIntentId: session.payment_intent,
                tax: tax / 100, // Convert from cents to dollars
                total: total / 100, // Convert from cents to dollars
            });
            console.log(`Order ${orderId} confirmed - payment completed. Tax: $${tax / 100}, Total: $${total / 100}`);

            // Clear user's cart after successful payment
            const userId = order.userId;
            if (userId) {
                const deletedCount = await CartProduct.destroy({
                    where: { userId }
                });
                console.log(`Cleared ${deletedCount} items from cart for user ${userId}`);
            }

            // Decrease product stock
            await this.decreaseProductStock(orderId);
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

        // Clear user's cart after successful payment
        const userId = order.userId;
        if (userId) {
            const deletedCount = await CartProduct.destroy({
                where: { userId }
            });
            console.log(`Cleared ${deletedCount} items from cart for user ${userId}`);
        }

        // Decrease product stock
        await this.decreaseProductStock(orderId);
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

        // Clear user's cart after successful payment
        const userId = order.userId;
        if (userId) {
            const deletedCount = await CartProduct.destroy({
                where: { userId }
            });
            console.log(`Cleared ${deletedCount} items from cart for user ${userId}`);
        }

        // Decrease product stock
        await this.decreaseProductStock(orderId);
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
