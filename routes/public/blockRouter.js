const Router = require('express')
const router = new Router()
const adminBlockController = require('../../controllers/adminBlockController')

router.get('/', adminBlockController.fetchBlock)

module.exports = router