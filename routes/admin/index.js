const Router = require('express');
const router = new Router();
const checkRole = require('../../middleware/checkRoleMiddleware')

const usersRouter = require('./usersRouter');
const blockRouter = require('./blockRouter');
const categoryRouter = require('./categoryRouter');
const productRouter = require('./productRouter');
const orderRouter = require('./orderRouter');
const arrivalRouter = require('./arrivalRouter');
const recipeRouter = require('./recipeRouter');
const promotionRouter = require('./promotionRouter');

router.use('/user', usersRouter);
router.use('/category', checkRole('ADMINISTRATOR'), categoryRouter);
router.use('/arrival', checkRole('ADMINISTRATOR'), arrivalRouter);
router.use('/block', checkRole('ADMINISTRATOR'), blockRouter);
router.use('/product', checkRole('ADMINISTRATOR'), productRouter);
router.use('/order', checkRole('ADMINISTRATOR'), orderRouter);
router.use('/recipe', checkRole('ADMINISTRATOR'), recipeRouter);
router.use('/promotion', checkRole('ADMINISTRATOR'), promotionRouter);

module.exports = router

