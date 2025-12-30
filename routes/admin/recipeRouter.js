const Router = require('express')
const router = new Router()
const recipeController = require('../../controllers/adminRecipeController')

router.get('/', recipeController.fetchRecipesList)
router.get('/category', recipeController.fetchRecipeCategory)
router.get('/:link', recipeController.fetchRecipe)
// router.get('/category', productController.fetchByCategory)
// router.get('/:id', productController.fetchOne)
router.post('/', recipeController.createRecipe)
router.post('/category', recipeController.createRecipeCategory)
router.put('/', recipeController.updateRecipe)
router.put('/category', recipeController.updateRecipeCategory)
// router.put('/', productController.update)
// router.delete('/', productController.delete)

module.exports = router