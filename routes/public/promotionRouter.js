const Router = require('express')
const router = new Router()
const promotionController = require('../../controllers/promotionController')

router.get('/', promotionController.fetch)

module.exports = router