jest.mock('../../models/models', () => ({
  Order: { findByPk: jest.fn() },
  OrderProduct: {},
  Product: {},
}));
jest.mock('../../utils/stripe', () => ({
  verifyWebhookSignature: jest.fn(),
  getCheckoutSession: jest.fn(),
  stripe: { checkout: { sessions: { list: jest.fn() } } },
}));
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
