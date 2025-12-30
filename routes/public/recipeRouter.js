const Router = require('express')
const router = new Router()
const recipeController = require('../../controllers/adminRecipeController')

router.get('/', recipeController.fetchRecipesList)
router.get('/:link', recipeController.fetchRecipe)

module.exports = router