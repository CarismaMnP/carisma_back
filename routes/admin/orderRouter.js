const Router = require('express')
const router = new Router()
const orderController = require('../../controllers/adminOrderController')

router.get('/', orderController.fetch)
router.get('/:id', orderController.fetchOne)
router.put('/', orderController.update)
router.put('/state', orderController.updateState)
router.post('/', orderController.cancel)

module.exports = router