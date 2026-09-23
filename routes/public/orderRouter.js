const Router = require('express')
const router = new Router()
const orderController = require('../../controllers/publicOrderController')

router.post('/', require('../../middleware/authMiddleware'), orderController.create)

module.exports = router