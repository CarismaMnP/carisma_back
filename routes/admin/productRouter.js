const Router = require('express')
const router = new Router()
const productController = require('../../controllers/adminProductController')

router.get('/', productController.fetch)
router.get('/category', productController.fetchByCategory)
router.get('/ebay_categories', productController.getEbayCategories)
router.get('/:link', productController.fetchOne)
router.post('/', (req, res, next) => productController.create(req, res, next))
router.post('/manual', (req, res, next) => productController.createManual(req, res, next))
router.put('/', productController.update)
router.delete('/', productController.delete)

module.exports = router
