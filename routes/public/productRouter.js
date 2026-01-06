const Router = require('express')
const router = new Router()
const productController = require('../../controllers/clientProductController')

router.get('/get_filter', productController.getFilter)
router.get('/products', productController.getProducts)
router.get('/fresh', productController.getFresh)
router.get('/product', productController.getProduct)
router.get('/', productController.getProducts)
router.get('/:link', productController.getProduct)

module.exports = router
