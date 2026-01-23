const Router = require('express');
const router = new Router();

// const usersRouter = require('./usersRouter');
const blockRouter = require('./blockRouter');
const productRouter = require('./productRouter');
const categoryRouter = require('./categoryRouter');
const userRouter = require('./usersRouter');
const recipeRouter = require('./recipeRouter');
const orderRouter = require('./orderRouter');
const paymentsRouter = require('./paymentsRouter');
const promotionRouter = require('./promotionRouter');
const arrivalsRouter = require('./arrivalsRouter');
const stripeWebhookRouter = require('./stripeWebhookRouter');

router.use('/block', blockRouter);
router.use('/order', orderRouter);
router.use('/product', productRouter);
router.use('/category', categoryRouter);
router.use('/user', userRouter);
router.use('/recipe', recipeRouter);
router.use('/payments', paymentsRouter);
router.use('/promotion', promotionRouter);
router.use('/arrivals', arrivalsRouter);
router.use('/stripe-webhook', stripeWebhookRouter);

module.exports = router
