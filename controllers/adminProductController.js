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

  async createProduct(req, res, next, { isManual = false } = {}) {
    console.log("createProduct")
    try {
      let files = req.files?.files;
      if (files && !Array.isArray(files)) {
        files = [files]
      }
      const {
        name, description, link, price, old_price, categoryId,
        about, weight, variation, processing, fermentation,
        region, farmer, keyDescriptor, brightness, recipe, additionalFields, selector,
        ebayCategory, ebayModel, count, ebayYear, ebayAdditionalNotes, ebayAlsoFits,
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
            const upload = await s3.Upload({buffer: file.data}, '/products/');
            const imageUrl = `https://pub-bc3786b523da4133a78648b83b419424.r2.dev/${upload.Key}`;

            return imageUrl
          }
          return null;
        });
      }

      const filesData = (await Promise.all(filesPromises)).filter(Boolean);
      const numericCount = count === undefined || count === null ? undefined : Number(count);
      const normalizedCount = Number.isFinite(numericCount) ? numericCount : undefined;
      const parsedEbayAlsoFits = Array.isArray(ebayAlsoFits)
        ? ebayAlsoFits
        : (typeof ebayAlsoFits === 'string' && ebayAlsoFits ? JSON.parse(ebayAlsoFits) : undefined);

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
        ebayCategory: ebayCategory || null,
        ebayModel: ebayModel || null,
        ebayYear: ebayYear || null,
        ebayAdditionalNotes: ebayAdditionalNotes || null,
        ...(parsedEbayAlsoFits ? { ebayAlsoFits: parsedEbayAlsoFits } : {}),
        ...(normalizedCount !== undefined ? { count: normalizedCount, ebayStock: normalizedCount } : {}),
        ...(isManual ? { isManual: true } : {}),
        description: description || '',
      });

      return res.json(product)
    } catch (e) {
      console.log(e)
      next(ApiError.badRequest(e.message));
    }
  }

  async create(req, res, next) {
    return this.createProduct(req, res, next, { isManual: false });
  }

  async createManual(req, res, next) {
    return this.createProduct(req, res, next, { isManual: true });
  }

  async update(req, res, next) {
    try {
      let files = req.files?.files;
      if (files && !Array.isArray(files)) {
        files = [files]
      }
      const {id} = req.query;
      const {
        name, description, link, price, old_price, categoryId,
        about, weight, variation, processing, fermentation,
        region, farmer, keyDescriptor, brightness, recipe, additionalFields, selector,
        ebayCategory, ebayModel, count, ebayYear, ebayAdditionalNotes, ebayAlsoFits,
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
            // 袟邪谐褉褍蟹泻邪 芯褉懈谐懈薪邪谢褜薪芯谐芯 懈蟹芯斜褉邪卸械薪懈褟
            const upload = await s3.Upload({buffer: file.data}, '/products/');
            const imageUrl = upload.Key;

            const previewBuffer = await sharp(file.data)
              .resize(24, 24)
              .toBuffer();

            // 袟邪谐褉褍蟹泻邪 屑懈薪懈邪褌褞褉褘 薪邪 S3
            const previewUpload = await s3.Upload({buffer: previewBuffer}, '/products/previews/');
            const previewUrl = previewUpload.Key;

            return {imageUrl, previewUrl}
          }
          return null;
        });
      }

      const filesData = (await Promise.all(filesPromises)).filter(Boolean);
      const numericCount = count === undefined || count === null ? undefined : Number(count);
      const normalizedCount = Number.isFinite(numericCount) ? numericCount : undefined;
      const parsedEbayAlsoFits = Array.isArray(ebayAlsoFits)
        ? ebayAlsoFits
        : (typeof ebayAlsoFits === 'string' && ebayAlsoFits ? JSON.parse(ebayAlsoFits) : undefined);

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
        ebayCategory: ebayCategory || null,
        ebayModel: ebayModel || null,
        ebayYear: ebayYear || null,
        ebayAdditionalNotes: ebayAdditionalNotes || null,
        ...(parsedEbayAlsoFits ? { ebayAlsoFits: parsedEbayAlsoFits } : {}),
        ...(normalizedCount !== undefined ? { count: normalizedCount, ebayStock: normalizedCount } : {}),
        description: description || '',
      }, {where: {id}});

      return res.json(product)
    } catch (e) {
      console.log(e)
      next(ApiError.badRequest(e.message));
    }
  }

  async getEbayCategories(req, res, next) {
    try {
      const categories = await Product.findAll({
        where: { isDeleted: false },
        attributes: ['ebayCategory'],
        raw: true,
      });

      const uniqueCategories = Array.from(
        new Set(
          categories
            .map((row) => (row.ebayCategory || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));

      return res.json(uniqueCategories);
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
