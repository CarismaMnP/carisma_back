const Router = require('express')
const router = new Router()
const usersController = require('../../controllers/adminUsersController')
const authMiddleware = require('../../middleware/authMiddleware')
const checkRole = require('../../middleware/checkRoleMiddleware')

router.post('/login', usersController.login)
router.get('/auth', authMiddleware, usersController.check)
router.get('/', checkRole('ADMINISTRATOR'), usersController.fetch)

module.exports = router