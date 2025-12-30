const Router = require('express')
const router = new Router()
const categoryController = require('../../controllers/adminCategoryController')

router.get('/', categoryController.fetch)
router.get('/:id', categoryController.fetchOne)
router.post('/', categoryController.create)
router.put('/', categoryController.update)
router.delete('/', categoryController.delete)

module.exports = router