const ApiError = require('../error/ApiError')
const { s3 } = require('../db');
const sharp = require('sharp');
const {Category, Product, Recipe, RecipeCategory} = require('../models/models')

class RecipeController {
    async fetchRecipesList(req, res, next) {
        try {
            let {page, limit, categoryId} = req.query
            let where = {}
            if(categoryId){
                where.recipeCategoryId = categoryId;
            }
            page = page || 1
            limit = limit || 100
            let offset = page * limit - limit
            const recipes = await Recipe.findAndCountAll({where, limit, offset, order: [['createdAt', 'ASC']], include: [{model: RecipeCategory}, {model: Product}]})
            return res.json(recipes)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    
    async fetchRecipe(req, res, next) {
        try {
            let {link} = req.params
            const recipe = await Recipe.findOne({where: {link}, include: [{model: Product, model: RecipeCategory}]})
            return res.json(recipe)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }
    
    async fetchRecipeCategory(req, res, next) {
        try {
            const recipeCategories = await RecipeCategory.findAll()
            return res.json(recipeCategories)
        } catch (e) {
            next(ApiError.badRequest(e.message))
        }
    }

    async createRecipeCategory(req, res, next) {
        try {
            const file = req.files?.file;
            const {name, description} = JSON.parse(req.body.data);

            let imageUrl = '';
            let previewUrl = '';

            if (file) {
                // Загрузка оригинального изображения
                const upload = await s3.Upload({ buffer: file.data }, '/recipes/');
                imageUrl = upload.Key;
    
                // Создание миниатюры 24x24px с помощью sharp

                const previewBuffer = await sharp(file.data)
                    .resize(24, 24)
                    .toBuffer();
    
                // Загрузка миниатюры на S3
                const previewUpload = await s3.Upload({ buffer: previewBuffer }, '/recipes/previews/');
                previewUrl = previewUpload.Key;
            }

            const recipeCategory = await RecipeCategory.create({
                name,
                description,
                imageUrl,
                previewUrl
            })
    
            return res.json(recipeCategory)
        } catch (e) {
            console.log(e)
            next(ApiError.badRequest(e.message));
        }
    }

    async createRecipe(req, res, next) {
        try {
            const files = req.files?.files;
            const image = req.files?.file;
            const {name, link, description, categoryId, productId, recipeSteps} = JSON.parse(req.body.data);

            let filesPromises = []
            
            if(files && files.length > 0){
                filesPromises = files.map(async (file) => {
                    if (file) {
                        // Загрузка оригинального изображения
                        const upload = await s3.Upload({ buffer: file.data }, '/recipes/');
                        const imageUrl = upload.Key;
            
                        // Создание миниатюры 24x24px с помощью sharp
    
                        const previewBuffer = await sharp(file.data)
                            .resize(24, 24)
                            .toBuffer();
            
                        // Загрузка миниатюры на S3
                        const previewUpload = await s3.Upload({ buffer: previewBuffer }, '/recipes/previews/');
                        const previewUrl = previewUpload.Key;
    
                        return {imageUrl, previewUrl, name: file.name}
                    }
                });
            }

            let imageUrl = ""
            
            if(image){
                const upload = await s3.Upload({ buffer: image.data }, '/recipes/');
                imageUrl = upload.Key;
            }

            const filesData = await Promise.all(filesPromises);

            const recipeData = recipeSteps.map((element) => {
                let fileData = {}
                
                if(element.fileName){
                    console.log(`search file ${element.fileName}`)
                    fileData = filesData.find(file => file.name === element.fileName)
                    console.log(fileData)
                }

                return {text: element.text, ...fileData}
            })

            const recipe = await Recipe.create({
                recipeCategoryId: categoryId,
                link,
                name,
                steps: recipeData,
                productId,
                description,
                imageUrl
            })
    
            return res.json(recipe)
        } catch (e) {
            console.log(e)
            next(ApiError.badRequest(e.message));
        }
    }
    
    async updateRecipeCategory(req, res, next) {
        try {
            const {id} = req.query;
            const file = req.files?.file;
            const {name, description} = JSON.parse(req.body.data);

            let imageUrl = '';
            let previewUrl = '';

            if (file) {
                // Загрузка оригинального изображения
                const upload = await s3.Upload({ buffer: file.data }, '/recipes/');
                imageUrl = upload.Key;
    
                // Создание миниатюры 24x24px с помощью sharp

                const previewBuffer = await sharp(file.data)
                    .resize(24, 24)
                    .toBuffer();
    
                // Загрузка миниатюры на S3
                const previewUpload = await s3.Upload({ buffer: previewBuffer }, '/recipes/previews/');
                previewUrl = previewUpload.Key;
            }

            const recipeCategory = await RecipeCategory.update({
                name,
                description,
                imageUrl,
                previewUrl
            }, {where: {id}})
    
            return res.json(recipeCategory)
        } catch (e) {
            console.log(e)
            next(ApiError.badRequest(e.message));
        }
    }

    async updateRecipe(req, res, next) {
        try {
            const {id} = req.query;
            const files = req.files?.files;
            const image = req.files?.file;
            const {name, link, description, categoryId, productId, recipeSteps} = JSON.parse(req.body.data);

            let filesPromises = []
            
            if(files && files.length > 0){
                filesPromises = files.map(async (file) => {
                    if (file) {
                        // Загрузка оригинального изображения
                        const upload = await s3.Upload({ buffer: file.data }, '/recipes/');
                        const imageUrl = upload.Key;
            
                        // Создание миниатюры 24x24px с помощью sharp
    
                        const previewBuffer = await sharp(file.data)
                            .resize(24, 24)
                            .toBuffer();
            
                        // Загрузка миниатюры на S3
                        const previewUpload = await s3.Upload({ buffer: previewBuffer }, '/recipes/previews/');
                        const previewUrl = previewUpload.Key;
    
                        return {imageUrl, previewUrl, name: file.name}
                    }
                });
            }

            let imageUrl = ""
            
            if(image){
                const upload = await s3.Upload({ buffer: image.data }, '/recipes/');
                imageUrl = upload.Key;
            }

            const filesData = await Promise.all(filesPromises);

            const recipeData = recipeSteps.map((element) => {
                let fileData = {}
                
                if(element.fileName){
                    console.log(`search file ${element.fileName}`)
                    fileData = filesData.find(file => file.name === element.fileName)
                    console.log(fileData)
                }

                return {text: element.text, ...fileData}
            })

            const recipe = await Recipe.update({
                recipeCategoryId: categoryId,
                link,
                name,
                steps: recipeData,
                productId,
                imageUrl,
                description
            }, {where: {id}})
    
            return res.json(recipe)
        } catch (e) {
            console.log(e)
            next(ApiError.badRequest(e.message));
        }
    }

    // async delete (req, res, next) {
    //     try {
    //         let {id} = req.query;
    //         await Product.update({isDeleted: true}, {where: {id}})
    //         return res.json("Deleted successfully");
    //     } catch (e) {
    //         next(ApiError.badRequest(e.message))
    //     }
    // }
}

module.exports = new RecipeController()