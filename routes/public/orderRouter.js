const Router = require('express')
const router = new Router()
const orderController = require('../../controllers/publicOrderController')
const freight=require('../../controllers/freightController')
const auth=require('../../middleware/authMiddleware')

const checkout=require('../../integrations/carparts/checkout')
const handle=fn=>async(req,res)=>{try{res.set('Cache-Control','private, no-store');res.json(await fn(req))}catch(e){res.status(e.status||400).json({message:e.message,...(e.addressSuggestion?{addressSuggestion:e.addressSuggestion}:{})})}}
const addresses=require('../../integrations/freight/addresses')
router.post('/address/context',auth,handle(req=>req.body.quoteId?addresses.context(req.user.id,req.body.quoteId):addresses.lookupZip(req.body.zip)))
router.post('/parcel-quote',auth,handle(req=>require('../../integrations/parcel/service').createQuote(Number(req.user.id),req.body)))
router.get('/history',auth,handle(req=>checkout.history(req.user.id,req.query.page)))
router.post('/:id/refund',auth,handle(req=>require('../../integrations/refunds/service').submit(req.user.id,req.params.id,req.body)))
router.post('/:id/resume',auth,handle(req=>checkout.withCheckoutLock(req.user.id,()=>checkout.resume(req.user.id,req.params.id))))
router.post('/:id/cancel',auth,handle(req=>checkout.withCheckoutLock(req.user.id,()=>checkout.cancel(req.user.id,req.params.id))))

router.post('/promo-quote',auth,handle(req=>require('../../integrations/pricing/promos').quote(req.body)))
router.post('/shipping-requirements', auth, freight.requirements)
router.post('/freight-quote', auth, freight.quote)

router.post('/', require('../../middleware/authMiddleware'), orderController.create)

module.exports = router
