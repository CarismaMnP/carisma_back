const Router = require('express')
const router = new Router()
const usersController = require('../../controllers/adminUsersController')
const authMiddleware = require('../../middleware/authMiddleware')
const currentAdmin = require('../../middleware/currentAdminMiddleware')

router.post('/login', usersController.login)
router.get('/auth', authMiddleware, usersController.check)
router.use(authMiddleware, currentAdmin)
router.get('/', usersController.fetch)
router.post('/export', usersController.export)
router.put('/:id/category', usersController.updateCategory)

module.exports = router