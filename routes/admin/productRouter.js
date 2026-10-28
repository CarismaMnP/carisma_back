const Router = require('express')
const router = new Router()
const productController = require('../../controllers/adminProductController')

router.get('/', productController.fetch)
router.get('/filters', productController.filters)
router.get('/category', productController.fetchByCategory)
router.get('/ebay_categories', productController.getEbayCategories)
router.get('/makes', productController.getMakes)
router.get('/categories', productController.getAllCategories)
const pricing = require('../../integrations/pricing/products');
const handle=fn=>async(req,res)=>{try{res.json(await fn(req))}catch(e){res.status(400).json({message:e.message})}};
router.post('/prices/preview',handle(req=>pricing.preview(req.user.id,req.body)));
router.post('/prices/:id/apply',handle(req=>pricing.apply(req.user.id,req.params.id)));
router.put('/:id/parcel-package',handle(req=>require('../../integrations/parcel/packages').save(req.params.id,req.body.parcelPackage)));
router.get('/:link', productController.fetchOne)
router.post('/', (req, res, next) => productController.create(req, res, next))
router.post('/manual', (req, res, next) => productController.createManual(req, res, next))
router.put('/', productController.update)
router.delete('/', productController.delete)

module.exports = router
