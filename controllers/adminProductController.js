const ApiError = require('../error/ApiError')
const {s3} = require('../db');
const sharp = require('sharp');
const {Category, Product} = require('../models/models');
const { v4 } = require('uuid');

class ProductController {
  async fetch(req, res, next) {
    try {
      let {page, limit} = req.query
      page = page || 1
      limit = limit || 1000
      let offset = page * limit - limit
      const products = await Product.findAndCountAll({
        limit,
        offset,
        order: [['name', 'ASC']],
        include: [{model: Category}]
      })
      return res.json(products)
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }

  async fetchOne(req, res, next) {
    try {
      const {link} = req.params;
      const product = await Product.findOne({where: {link}, include: [{model: Category}]})
      return res.json(product)
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }

  async fetchByCategory(req, res, next) {
    try {
      const categories = await Category.findAll({include: [{model: Product, required: true}]})
      return res.json(categories)
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }

  async create(req, res, next) {
    try {
      let files = req.files?.files;
      if (!files.length) {
        files = [files]
      }
      const {
        name, description, link, price, old_price, categoryId,
        about, weight, variation, processing, fermentation,
        region, farmer, keyDescriptor, brightness, recipe, additionalFields, selector,
      } = JSON.parse(req.body.data);

      let filesPromises = []

      let recipeJSON = ""
      if (recipe) {
        recipeJSON = JSON.parse(recipe)
      }

      let additionalFieldsJSON = ""
      if (additionalFields) {
        additionalFieldsJSON = JSON.parse(additionalFields)
      }
      let selectorJSON = ""
      if (selector) {
        selectorJSON = JSON.parse(selector)
      }

      if (files && files.length > 0) {
        console.log("files")
        console.log(files)
        filesPromises = files.map(async (file) => {
          if (file) {
            // Загрузка оригинального изображения
            const upload = await s3.Upload({buffer: file.data}, '/products/');
            const imageUrl = upload.Key;

            const previewBuffer = await sharp(file.data)
              .resize(24, 24)
              .toBuffer();

            // Загрузка миниатюры на S3
            const previewUpload = await s3.Upload({buffer: previewBuffer}, '/products/previews/');
            const previewUrl = previewUpload.Key;

            return {imageUrl, previewUrl}
          }
        });
      }

      const filesData = await Promise.all(filesPromises);

      const product = await Product.create({
        name,
        description,
        link,
        price,
        old_price,
        categoryId,
        about,
        weight,
        variation,
        processing,
        fermentation,
        region,
        farmer,
        keyDescriptor,
        brightness,
        images: filesData,
        recipe: recipeJSON,
        additionalFields: additionalFieldsJSON,
        selector: selectorJSON,
      });

      return res.json(product)
    } catch (e) {
      console.log(e)
      next(ApiError.badRequest(e.message));
    }
  }

  async update(req, res, next) {
    try {
      let files = req.files?.files;
      if (!files.length) {
        files = [files]
      }
      const {id} = req.query;
      const {
        name, description, link, price, old_price, categoryId,
        about, weight, variation, processing, fermentation,
        region, farmer, keyDescriptor, brightness, recipe, additionalFields, selector
      } = JSON.parse(req.body.data);


      let recipeJSON = ""
      if (recipe) {
        recipeJSON = JSON.parse(recipe)
      }

      let additionalFieldsJSON = ""
      if (additionalFields) {
        additionalFieldsJSON = JSON.parse(additionalFields)
      }

      let selectorJSON = ""
      console.log(selector)
      if (selector) {
        selectorJSON = JSON.parse(selector) || ''
      }

      let filesPromises = []

      if (files && files.length > 0) {
        filesPromises = files.map(async (file) => {
          if (file) {
            // Загрузка оригинального изображения
            const upload = await s3.Upload({buffer: file.data}, '/products/');
            const imageUrl = upload.Key;

            const previewBuffer = await sharp(file.data)
              .resize(24, 24)
              .toBuffer();

            // Загрузка миниатюры на S3
            const previewUpload = await s3.Upload({buffer: previewBuffer}, '/products/previews/');
            const previewUrl = previewUpload.Key;

            return {imageUrl, previewUrl}
          }
        });
      }

      const filesData = await Promise.all(filesPromises);

      const product = await Product.update({
        name,
        description,
        link,
        price,
        old_price,
        categoryId,
        about,
        weight,
        variation,
        processing,
        fermentation,
        region,
        farmer,
        keyDescriptor,
        brightness,
        images: filesData,
        recipe: recipeJSON,
        additionalFields: additionalFieldsJSON,
        selector: selectorJSON,
      }, {where: {id}});

      return res.json(product)
    } catch (e) {
      console.log(e)
      next(ApiError.badRequest(e.message));
    }
  }

  async delete(req, res, next) {
    try {
      let {id} = req.query;
      const uid = v4()
      await Product.update({link: uid, isDeleted: true}, {where: {id}})
      return res.json("Deleted successfully");
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }
}

module.exports = new ProductController()