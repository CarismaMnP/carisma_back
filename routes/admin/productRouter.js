const Router = require('express')
const router = new Router()
const productController = require('../../controllers/adminProductController')

router.get('/', productController.fetch)
router.get('/category', productController.fetchByCategory)
router.get('/:link', productController.fetchOne)
router.post('/', productController.create)
router.put('/', productController.update)
router.delete('/', productController.delete)

module.exports = router