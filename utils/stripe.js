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
// The place where pickup goods are handed to the buyer. Never take this address
// from the request or use it as the buyer's billing/contact address.
const PICKUP_ADDRESS = Object.freeze({
  line1: '1300 W Beaver St', city: 'Jacksonville', state: 'FL',
  postal_code: '32209', country: 'US',
});
const {testConfig, authorizedStripeTest} = require('./stripeTest');
function stripeForOrder(orderId, livemode = true) {
  if (livemode !== false) return stripe;
  if (!authorizedStripeTest(orderId)) {
    if (process.env.NODE_ENV !== 'production') return stripe;
    throw Error('Stripe test order is not authorized');
  }
  return new Stripe(testConfig().secretKey);
}

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
async function createCheckoutSession({ orderId, amount, customerEmail, lineItems, collectShippingAddress, freight, shipping, pickup, resaleTaxExempt = false, resaleApplicationId, authorizedTestId }) {
  try {
    if (authorizedTestId && (authorizedTestId !== orderId || !authorizedStripeTest(orderId)))
      throw Error('Stripe test checkout is not authorized');
    if (resaleTaxExempt && (!resaleApplicationId || resaleTaxExempt!==true))
      throw Error('An approved certificate snapshot is required for tax exemption');
    const taxStatus=resaleTaxExempt===true?'exempt':'none';
    const taxMetadata={resaleTaxExempt:String(resaleTaxExempt===true),...(resaleApplicationId?{resaleApplicationId}: {})};
    const client = authorizedTestId ? stripeForOrder(orderId, false) : stripe;
    if (pickup && (shipping || freight || collectShippingAddress))
      throw Error('Pickup cannot be combined with a delivery address or shipping quote');
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      expires_at: Math.floor(Date.now()/1000)+30*60,
      success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: process.env.STRIPE_CANCEL_URL,
      customer_email: customerEmail,
      metadata: {
        orderId: orderId,
        ...taxMetadata,
      },
      payment_intent_data: {
        metadata: {
          orderId: orderId,
          ...taxMetadata,
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

    let customerId=null;
    const delivery=shipping || (freight ? {...freight,freightQuoteId:freight.quoteId,label:'Freight delivery · lift-gate & insurance'} : null);
    if (pickup) {
      const metadata={...taxMetadata,orderId,fulfillment:'pickup',pickupLocation:'jacksonville'};
      // Checkout Tax prioritizes a customer's saved shipping address over billing.
      // Create a customer per order so pickup never changes an existing customer's
      // shipping address. Collect real billing details separately in Checkout.
      const customer=await client.customers.create({name:pickup.name,email:customerEmail,phone:pickup.phone,tax_exempt:taxStatus,
        shipping:{name:pickup.name,phone:pickup.phone,address:{...PICKUP_ADDRESS}},metadata},
        {idempotencyKey:`checkout-customer:${orderId}`});
      customerId=customer.id;
      delete sessionConfig.customer_email;
      sessionConfig.customer=customerId;
      sessionConfig.billing_address_collection='required';
      sessionConfig.customer_update={address:'auto'};
      sessionConfig.adaptive_pricing={enabled:false};
      Object.assign(sessionConfig.metadata,metadata);
      Object.assign(sessionConfig.payment_intent_data.metadata,metadata);
      sessionConfig.custom_text={submit:{message:'Free pickup at Carisma M & P, 1300 W Beaver St, Jacksonville, FL 32209. '+(resaleTaxExempt?'Your approved resale exemption applies to this order.':'Sales tax is calculated for this pickup location.')}};
    } else if (delivery) {
      if (!Number.isSafeInteger(delivery.amountCents) || delivery.amountCents<0 ||
          ((delivery.freightQuoteId||delivery.parcelQuoteId)&&delivery.amountCents===0) || !delivery.address?.postal_code)
        throw Error('A valid shipping quote and delivery address are required');
      const customer=await client.customers.create({name:delivery.name,email:customerEmail,phone:delivery.phone,tax_exempt:taxStatus,
        shipping:{name:delivery.name,phone:delivery.phone,address:delivery.address},metadata:{orderId,...taxMetadata}},
        {idempotencyKey:`checkout-customer:${orderId}`});
      customerId=customer.id;
      delete sessionConfig.customer_email;
      delete sessionConfig.shipping_address_collection;
      sessionConfig.customer=customerId;
      sessionConfig.adaptive_pricing={enabled:false};
      for(const key of ['freightQuoteId','parcelQuoteId'])if(delivery[key]){
        sessionConfig.metadata[key]=delivery[key];sessionConfig.payment_intent_data.metadata[key]=delivery[key];
      }
      sessionConfig.shipping_options=[{shipping_rate_data:{type:'fixed_amount',
        fixed_amount:{amount:delivery.amountCents,currency:'usd'},display_name:delivery.label||'Delivery',
        tax_behavior:'exclusive',tax_code:'txcd_92010001'}}];
      const a=delivery.address;
      sessionConfig.custom_text={submit:{message:`Delivery to ${[a.line1,a.line2,a.city,a.state,a.postal_code].filter(Boolean).join(', ')}. To change the delivery address, return to Carisma before paying.`.slice(0,1200)}};
    }
    if(resaleTaxExempt&&!customerId){
      const customer=await client.customers.create({email:customerEmail,tax_exempt:taxStatus,metadata:{orderId,...taxMetadata}},
        {idempotencyKey:`checkout-customer:${orderId}`});
      customerId=customer.id;delete sessionConfig.customer_email;sessionConfig.customer=customerId;
      sessionConfig.customer_update={address:'auto'};
    }
    const session = await client.checkout.sessions.create(sessionConfig, {idempotencyKey: `checkout:${orderId}`});

    return {
      url: session.url,
      expiresAt: session.expires_at ? new Date(session.expires_at*1000) : null,
      sessionId: session.id,
      paymentIntentId: session.payment_intent,
      customerId,
    };
  } catch (error) {
    console.error('Error creating Stripe checkout session:', error.type || 'checkout_error');
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
    const config=testConfig();
    if (config) {
      const testEvent=stripe.webhooks.constructEvent(payload, signature, config.webhookSecret);
      if (testEvent.livemode !== false) throw Error('Test signature cannot authorize live events');
      return testEvent;
    }
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
async function getCheckoutSession(sessionId, {orderId, livemode = true} = {}) {
  try {
    const session = await stripeForOrder(orderId, livemode).checkout.sessions.retrieve(sessionId);
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
  stripeForOrder,
};
