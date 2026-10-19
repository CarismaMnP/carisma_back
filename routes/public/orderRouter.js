const Router = require('express')
const router = new Router()
const orderController = require('../../controllers/publicOrderController')
const freight=require('../../controllers/freightController')
const auth=require('../../middleware/authMiddleware')

router.post('/shipping-requirements', auth, freight.requirements)
router.post('/freight-quote', auth, freight.quote)

router.post('/', require('../../middleware/authMiddleware'), orderController.create)

module.exports = router
