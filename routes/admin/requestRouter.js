const Router = require('express')
const router = new Router()
const requestController = require('../../controllers/adminRequestController')

router.get('/part/requests', requestController.fetchPartRequests)
router.get('/client/requests', requestController.fetchClientMessageRequests)
router.post('/read', requestController.markAsRead)

module.exports = router
