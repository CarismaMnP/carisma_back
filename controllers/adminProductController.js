const ApiError = require('../error/ApiError')
const {s3} = require('../db');
const {Category, Product} = require('../models/models');
const { v4 } = require('uuid');
const { Op } = require('sequelize');

class ProductController {
  async fetch(req, res, next) {
    try {
      const f = require('../utils/adminProductFilters').filters(req.query);
      const [products, active, inactive] = await Promise.all([
        Product.findAndCountAll({where:f.where, limit:f.limit, offset:f.offset, order:f.order, include:[{model:Category}]}),
        Product.count({where:{[Op.and]:[f.base,f.available]}}),
        Product.count({where:{[Op.and]:[f.base,f.unavailable]}}),
      ]);
      return res.json({...products,active,inactive,page:f.page,limit:f.limit});
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }

  async filters(req, res, next) {
    try {
      const rows = await Product.findAll({attributes:['make','ebayModel'], group:['make','ebayModel'],
        order:[['make','ASC'],['ebayModel','ASC']],raw:true});
      const makes = new Map();
      for (const row of rows) {
        if (!row.make) continue;
        if (!makes.has(row.make)) makes.set(row.make, []);
        if (row.ebayModel) makes.get(row.make).push(row.ebayModel);
      }
      res.json([...makes].map(([make,models]) => ({make,models})));
    } catch(e) {next(ApiError.badRequest(e.message));}
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

  async createProduct(req, res, next, { isManual = true } = {}) {
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
        ebayCategory, ebayModel, count, ebayYear, ebayAdditionalNotes, ebayAlsoFits, make, freightCategoryCode,
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
        source: 'manual',
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
        freightCategoryCode: require('../integrations/freight/profiles').validateManualCode(freightCategoryCode),
        ebayCategory: ebayCategory || null,
        ebayModel: ebayModel || null,
        ebayYear: ebayYear || null,
        ebayAdditionalNotes: ebayAdditionalNotes || null,
        make: String(make||'').trim().toUpperCase()==='BAVARIAN MOTOR WORKS (BMW)'?'BMW':make || null,
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
    return this.createProduct(req, res, next, { isManual: true });
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
      const existing=await Product.findByPk(id);
      if(!existing)return next(ApiError.badRequest('Product not found'));
      if(existing.source==='carparts')return res.status(409).json({message:'This product is managed in Checkmate. Create a manual copy to manage a separate item.'});
      if(existing.source==='legacy')return res.status(409).json({message:'This is an archived imported product. Create a manual copy to manage a separate item.'});
      const {
        name, description, link, price, old_price, categoryId,
        about, weight, variation, processing, fermentation,
        region, farmer, keyDescriptor, brightness, recipe, additionalFields, selector,
        ebayCategory, ebayModel, count, ebayYear, ebayAdditionalNotes, ebayAlsoFits, make, freightCategoryCode,
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
      if (selector) {
        selectorJSON = JSON.parse(selector)
      }

      let filesPromises = []

      if (files && files.length > 0) {
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
        ...(filesData.length ? {images: filesData} : {}),
        recipe: recipeJSON,
        additionalFields: additionalFieldsJSON,
        selector: selectorJSON,
        ...(freightCategoryCode !== undefined ? {freightCategoryCode: require('../integrations/freight/profiles').validateManualCode(freightCategoryCode)} : {}),
        ebayCategory: ebayCategory || null,
        ebayModel: ebayModel || null,
        ebayYear: ebayYear || null,
        ebayAdditionalNotes: ebayAdditionalNotes || null,
        make: String(make||'').trim().toUpperCase()==='BAVARIAN MOTOR WORKS (BMW)'?'BMW':make || null,
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

  async getMakes(req, res, next) {
    try {
      const makes = await Product.findAll({
        where: { isDeleted: false },
        attributes: ['make'],
        raw: true,
      });

      const uniqueMakes = Array.from(
        new Set(
          makes
            .map((row) => (row.make || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b));

      return res.json(uniqueMakes);
    } catch (e) {
      console.log(e)
      next(ApiError.badRequest(e.message));
    }
  }

  async getAllCategories(req, res, next) {
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
      await Product.update({isDeleted: true, adminHidden: true, count: 0}, {where: {id}})
      return res.json("Deleted successfully");
    } catch (e) {
      next(ApiError.badRequest(e.message))
    }
  }
}

module.exports = new ProductController()
