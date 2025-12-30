const Router = require('express')
const router = new Router()
const adminArrivalsController = require('../../controllers/adminArrivalsController')

router.get('/', adminArrivalsController.fetch)
router.get('/:id', adminArrivalsController.fetchOne)
router.post('/', adminArrivalsController.create)
router.put('/', adminArrivalsController.update)
router.delete('/', adminArrivalsController.delete)

module.exports = router