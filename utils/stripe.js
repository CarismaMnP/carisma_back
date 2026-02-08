/**
 * Stripe Integration with Automatic Tax Calculation
 *
 * To enable automatic tax calculation:
 *
 * 1. Enable Stripe Tax in your Stripe Dashboard:
 *    - Go to https://dashboard.stripe.com/settings/tax
 *    - Click "Enable Stripe Tax"
 *    - Configure your tax settings and tax registrations
 *
 * 2. Add tax codes to your products (already configured in code):
 *    - We use 'txcd_99999999' (General - Tangible Goods) for auto parts
 *    - See full list: https://stripe.com/docs/tax/tax-categories
 *
 * 3. Set up webhook endpoint in Stripe Dashboard:
 *    - Go to https://dashboard.stripe.com/webhooks
 *    - Add endpoint: https://your-domain.com/api/stripe/webhook
 *    - Select events: checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed
 *    - Copy the webhook secret to .env as STRIPE_WEBHOOK_SECRET
 *
 * 4. Test in Stripe test mode using test addresses:
 *    - Use address with state "CA" (California) for high tax rates
 *    - Use card: 4242 4242 4242 4242 for successful payments
 */

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Create a Stripe Checkout Session for payment
 * @param {Object} params - Payment parameters
 * @param {string} params.orderId - Order ID
 * @param {number} params.amount - Amount in USD
 * @param {string} params.customerEmail - Customer email
 * @param {Array} params.lineItems - Array of line items
 * @param {boolean} params.collectShippingAddress - Whether Stripe Checkout should collect shipping address
 * @returns {Promise<Object>} - Checkout session object with url and id
 */
async function createCheckoutSession({ orderId, amount, customerEmail, lineItems, collectShippingAddress }) {
  try {
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      customer_email: customerEmail,
      metadata: {
        orderId: orderId,
      },
      payment_intent_data: {
        metadata: {
          orderId: orderId,
        },
      },
      // Enable automatic tax calculation
      automatic_tax: {
        enabled: true,
      },
    };

    // Collect shipping address in Stripe Checkout (required for tax calculation on shipped orders)
    if (collectShippingAddress) {
      sessionConfig.shipping_address_collection = {
        allowed_countries: ['US'], // Можно добавить другие страны
      };

      // Basic shipping option (0$ by default). Adjust if you need real UPS rates.
      sessionConfig.shipping_options = [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: 0, // Укажите стоимость доставки в центах
              currency: 'usd',
            },
            display_name: 'Standard Shipping',
          },
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return {
      url: session.url,
      sessionId: session.id,
      paymentIntentId: session.payment_intent,
    };
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error);
    throw error;
  }
}

/**
 * Verify webhook signature
 * @param {string} payload - Request body
 * @param {string} signature - Stripe signature header
 * @returns {Object} - Verified event object
 */
function verifyWebhookSignature(payload, signature) {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    throw error;
  }
}

/**
 * Retrieve payment intent details
 * @param {string} paymentIntentId - Payment intent ID
 * @returns {Promise<Object>} - Payment intent object
 */
async function getPaymentIntent(paymentIntentId) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent;
  } catch (error) {
    console.error('Error retrieving payment intent:', error);
    throw error;
  }
}

/**
 * Retrieve checkout session details
 * @param {string} sessionId - Checkout session ID
 * @returns {Promise<Object>} - Checkout session object
 */
async function getCheckoutSession(sessionId) {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch (error) {
    console.error('Error retrieving checkout session:', error);
    throw error;
  }
}

module.exports = {
  stripe,
  createCheckoutSession,
  verifyWebhookSignature,
  getPaymentIntent,
  getCheckoutSession,
};
