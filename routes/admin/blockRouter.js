const Router = require('express')
const router = new Router()
const adminBlockController = require('../../controllers/adminBlockController')

router.get('/', adminBlockController.fetchBlock)
router.put('/', adminBlockController.updateBlock)

module.exports = router