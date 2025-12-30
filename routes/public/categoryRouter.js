const Router = require('express')
const router = new Router()
const categoryController = require('../../controllers/clientCategoryController')

router.get('/', categoryController.fetch)
router.get('/main', categoryController.fetchMainCategories)
router.get('/by/parent/:parentId', categoryController.fetchSubCategories)

module.exports = router