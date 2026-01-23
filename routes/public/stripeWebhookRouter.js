const Router = require('express');
const router = new Router();
const stripeWebhookController = require('../../controllers/stripeWebhookController');

// Stripe webhook endpoint
// Note: This endpoint needs to receive raw body for signature verification
router.post('/', stripeWebhookController.handleWebhook.bind(stripeWebhookController));

module.exports = router;
