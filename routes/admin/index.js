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
const requestRouter = require('./requestRouter');
const promos=require('../../integrations/pricing/promos');
const handle=fn=>async(req,res)=>{try{res.json(await fn(req))}catch(e){res.status(400).json({message:e.name==='SequelizeUniqueConstraintError'?'This promo code already exists':e.message})}};
router.get('/promo-codes',checkRole('ADMINISTRATOR'),handle(()=>promos.list()));
router.post('/promo-codes',checkRole('ADMINISTRATOR'),handle(req=>promos.save(null,req.body)));
router.put('/promo-codes/:id',checkRole('ADMINISTRATOR'),handle(req=>promos.save(req.params.id,req.body)));
const freight=require('../../controllers/freightController');
router.get('/parcel/quotes',checkRole('ADMINISTRATOR'),handle(req=>require('../../integrations/parcel/service').list(req.query.page)));
router.get('/freight/quotes',checkRole('ADMINISTRATOR'),freight.list);
router.get('/freight/profiles',checkRole('ADMINISTRATOR'),freight.profiles);

router.get('/carparts/status', checkRole('ADMINISTRATOR'), async (req,res,next)=>{try{res.json(await require('../../integrations/carparts/status').getStatus());}catch(e){next(e)}});
router.use('/resale',require('../resaleRouter')({admin:true}));
router.use('/user', usersRouter);
router.use('/category', checkRole('ADMINISTRATOR'), categoryRouter);
router.use('/arrival', checkRole('ADMINISTRATOR'), arrivalRouter);
router.use('/block', checkRole('ADMINISTRATOR'), blockRouter);
router.use('/product', checkRole('ADMINISTRATOR'), productRouter);
router.use('/order', checkRole('ADMINISTRATOR'), orderRouter);
router.use('/recipe', checkRole('ADMINISTRATOR'), recipeRouter);
router.use('/promotion', checkRole('ADMINISTRATOR'), promotionRouter);
router.use('/request', checkRole('ADMINISTRATOR'), requestRouter);

module.exports = router
