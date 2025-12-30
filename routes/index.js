const Router = require('express');
const router = new Router();
const checkRole = require('../middleware/checkRoleMiddleware');

const adminRouter = require('./admin/index');
const publicRouter = require('./public/index');

router.use('/admin', adminRouter);
router.use('/public', publicRouter);
// router.use('/billing', checkRole('USER', 'ADMINISTRATOR'), billingRouter);

module.exports = router;
