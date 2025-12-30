const Router = require('express')
const router = new Router()
const publicArrivalsController = require('../../controllers/publicArrivalsController')

router.get('/', publicArrivalsController.fetch)

module.exports = router