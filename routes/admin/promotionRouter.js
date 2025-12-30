const Router = require('express')
const router = new Router()
const promotionController = require('../../controllers/promotionController')

router.get('/', promotionController.fetch)
router.post('/', promotionController.create)
router.put('/', promotionController.update)
router.delete('/', promotionController.delete)

module.exports = router