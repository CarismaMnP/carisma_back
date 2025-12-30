const Router = require('express')
const router = new Router()
const paymentsController = require('../../controllers/paymentsController')

router.post('/check', paymentsController.check)
router.post('/pay', paymentsController.pay)
router.post('/confirm', paymentsController.confirm)
router.post('/receipt', paymentsController.receipt)

module.exports = router