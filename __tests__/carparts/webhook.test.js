jest.mock('../../models/models', () => ({
  Order: { findByPk: jest.fn() },
  OrderProduct: {},
  Product: {},
}));
jest.mock('../../utils/stripe', () => ({
  verifyWebhookSignature: jest.fn(),
  getCheckoutSession: jest.fn(),
  stripe: { checkout: { sessions: { list: jest.fn() } } },
  stripeForOrder: jest.fn(),
}));
jest.mock('../../utils/stripeTest',()=>({authorizedStripeTest:jest.fn(()=>false)}));
jest.mock('../../integrations/carparts/orders', () => ({
  confirmPayment: jest.fn(),
  releaseReservation: jest.fn(),
}));
jest.mock('../../utils/mailer', () => ({
  sendOrderConfirmation: jest.fn(),
  sendOrderNotification: jest.fn(),
}));
const controller = require('../../controllers/stripeWebhookController');
const { Order } = require('../../models/models');
const stripe = require('../../utils/stripe');
const { confirmPayment } = require('../../integrations/carparts/orders');
const session = {
  id: 'cs_test',
  metadata: { orderId: 'order' },
  payment_status: 'paid',
  currency: 'usd',
  amount_subtotal: 2500,
  amount_total: 2700,
  total_details: { amount_tax: 200 },
  payment_intent: 'pi_test',
  livemode: true,
};
beforeEach(() => {
  jest.clearAllMocks();
  Order.findByPk.mockResolvedValue({
    id: 'order',
    sum: 25,
    checkoutSessionId: 'cs_test',
    delivey_type: 'pickup',
  });
  stripe.getCheckoutSession.mockResolvedValue(session);
  confirmPayment.mockResolvedValue({ applied: false });
  stripe.stripeForOrder.mockReturnValue(stripe.stripe);
});
test('payment reference comes from retrieved Stripe session, never from the event copy',async()=>{
 await controller.confirmSession({...session,payment_intent:'pi_stale'},{livemode:true,created:1000});
 expect(confirmPayment.mock.calls[0][1].paymentIntentId).toBe('pi_test');
});
describe('bounded production test events',()=>{
 let previous;const {authorizedStripeTest}=require('../../utils/stripeTest');
 const response=()=>({json:jest.fn(),status:jest.fn().mockReturnThis(),send:jest.fn()});
 beforeEach(()=>{previous=process.env.NODE_ENV;process.env.NODE_ENV='production';authorizedStripeTest.mockReturnValue(false)});
 afterEach(()=>{process.env.NODE_ENV=previous});
 async function deliver(type,object=session,livemode=false){
  stripe.verifyWebhookSignature.mockReturnValue({type,livemode,created:1000,data:{object}});
  const res=response();await controller.handleWebhook({headers:{'stripe-signature':'signature'},body:'raw'},res);return res;
 }
 test('unapproved test events cannot reserve, release, or confirm anything',async()=>{
  const res=await deliver('checkout.session.expired');
  expect(res.json).toHaveBeenCalledWith({received:true,ignored:'test event'});
  expect(confirmPayment).not.toHaveBeenCalled();expect(require('../../integrations/carparts/orders').releaseReservation).not.toHaveBeenCalled();
 });
 test('allowlist alone cannot mutate a normal customer order',async()=>{
  authorizedStripeTest.mockReturnValue(true);const res=await deliver('checkout.session.completed');
  expect(res.json).toHaveBeenCalledWith({received:true,ignored:'not an integration test order'});
  expect(confirmPayment).not.toHaveBeenCalled();
 });
 test('approved test payment verifies test Stripe data but never claims live money or sends email',async()=>{
  authorizedStripeTest.mockReturnValue(true);
  Order.findByPk.mockResolvedValue({id:'order',sum:25,checkoutSessionId:'cs_test',isIntegrationTest:true,paidLive:false});
  stripe.getCheckoutSession.mockResolvedValue({...session,livemode:false});
  confirmPayment.mockResolvedValue({applied:true,order:{isIntegrationTest:true}});
  const email=jest.spyOn(controller,'sendOrderConfirmationEmail');
  const res=await deliver('checkout.session.completed');
  expect(res.json).toHaveBeenCalledWith({received:true});
  expect(stripe.getCheckoutSession).toHaveBeenCalledWith('cs_test',{orderId:'order',livemode:false});
  expect(confirmPayment.mock.calls[0][1].paidLive).toBe(false);expect(email).not.toHaveBeenCalled();email.mockRestore();
 });
 test.each(['checkout.session.completed','checkout.session.async_payment_succeeded'])('unpaid %s does not create a work order',async type=>{
  await deliver(type,{...session,payment_status:'unpaid'},true);expect(confirmPayment).not.toHaveBeenCalled();
 });
 test('invalid signature cannot change inventory',async()=>{
  stripe.verifyWebhookSignature.mockImplementationOnce(()=>{throw Error('bad signature')});
  const res=response();await controller.handleWebhook({headers:{},body:'raw'},res);
  expect(res.status).toHaveBeenCalledWith(400);expect(confirmPayment).not.toHaveBeenCalled();
 });
});
test('a verified paid session supplies tax and payment identity to the atomic operation', async () => {
  await controller.confirmSession(session, { livemode: true, created: 1000 });
  expect(confirmPayment).toHaveBeenCalledWith(
    'order',
    expect.objectContaining({
      paidLive: true,
      paymentIntentId: 'pi_test',
      updates: expect.objectContaining({ tax: 2, total: 27, checkoutSessionId: 'cs_test' }),
    }),
  );
});
test.each([
  { currency: 'eur' },
  { amount_subtotal: 1 },
  { metadata: { orderId: 'different' } },
  { livemode: false },
  { payment_status: 'unpaid' },
  { id: 'wrong-session' },
])('mismatched paid data cannot change stock: %j', async mismatch => {
  stripe.getCheckoutSession.mockResolvedValue({ ...session, ...mismatch });
  await expect(
    controller.confirmSession(session, { livemode: true, created: 1000 }),
  ).rejects.toThrow('does not match');
  expect(confirmPayment).not.toHaveBeenCalled();
});

test('freight confirmation keeps the fixed shipping address and records paid shipping',async()=>{
 const freightAddress={line1:'1 Test St',city:'Winter Garden',state:'FL',postal_code:'34787',country:'US'};
 Order.findByPk.mockResolvedValue({id:'order',sum:25,checkoutSessionId:'cs_test',delivey_type:'freight',freightQuoteId:'q',stripeCustomerId:'cus',shippingExpectedCents:22961,freightAddress});
 stripe.getCheckoutSession.mockResolvedValue({...session,metadata:{orderId:'order',freightQuoteId:'q'},customer:'cus',amount_total:25461,total_details:{amount_shipping:22961,amount_tax:0},customer_details:{address:{postal_code:'10001'}}});
 await controller.confirmSession(session,{livemode:true,created:1000});
 expect(confirmPayment).toHaveBeenCalledWith('order',expect.objectContaining({updates:expect.objectContaining({shippingAddress:freightAddress,shippingAmount:229.61})}));
 expect(confirmPayment.mock.calls[0][1].updates.shippingReview).toBeUndefined();
});
test('a paid shipping discrepancy is recorded for review while preventing resale',async()=>{
 Order.findByPk.mockResolvedValue({id:'order',sum:25,checkoutSessionId:'cs_test',shippingExpectedCents:22961});
 await controller.confirmSession(session,{livemode:true,created:1000});
 expect(confirmPayment).toHaveBeenCalledWith('order',expect.objectContaining({updates:expect.objectContaining({shippingReview:expect.any(String)})}));
});
