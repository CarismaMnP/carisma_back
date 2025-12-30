const Router = require('express')
const router = new Router()
const orderController = require('../../controllers/publicOrderController')

router.get('/office', orderController.office)
router.get('/tariffs', orderController.tariffs)
router.get('/city', orderController.city)
router.post('/', orderController.create)

module.exports = router