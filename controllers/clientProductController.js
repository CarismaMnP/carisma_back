const ApiError = require('../error/ApiError')
const {s3} = require('../db');
const sharp = require('sharp');
const {Category, Product} = require('../models/models')
const Op = require('sequelize').Op;

class ProductController {
  async getFilter(req, res, next) {
    try {
      const products = await Product.findAll({
        attributes: ['ebayModel', 'ebayCategory'],
        where: { isDeleted: false, count: {[Op.ne]: 0} },
        raw: true,
      });

      const grouped = new Map();

      products.forEach(({ ebayModel, ebayCategory }) => {
        const modelKey = (ebayModel || '').trim();
        if (!modelKey) return;

        const categories = grouped.get(modelKey) || new Set();
        if (ebayCategory) {
          categories.add(ebayCategory.trim());
        }
        grouped.set(modelKey, categories);
      });

      const response = Array.from(grouped.entries())
        .map(([model, categories]) => ({
          model,
          categories: Array.from(categories).sort((a, b) => a.localeCompare(b)),
        }))
        .sort((a, b) => a.model.localeCompare(b.model));

      return res.json(response);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getProducts(req, res, next) {
    try {
      const { model, category, name } = req.query;
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const requestedLimit = parseInt(req.query.limit, 10);
      const limit =
        Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.min(requestedLimit, 150)
          : 150;
      const offset = (page - 1) * limit;

      const where = {
        isDeleted: false,
        ...(model ? { ebayModel: model } : {}),
        ...(category ? { ebayCategory: category } : {}),
        ...(name
          ? { name: { [Op.iLike]: `%${name.replace(/[%_]/g, '\\$&')}%` } }
          : {}),
      };

      const products = await Product.findAndCountAll({
        where,
        order: [
          ['ebayCategory', 'ASC'],
          ['name', 'ASC'],
        ],
        attributes: ["id", "name", "link", "images", "price", "count", "ebayStock", "ebayModel", "ebayCategory"],
        limit,
        offset,
      });

      const grouped = products.rows.reduce((acc, product) => {
        const productPlain = product.get({ plain: true });
        const categoryKey = productPlain.ebayCategory || 'uncategorized';

        if (!acc[categoryKey]) {
          acc[categoryKey] = [];
        }
        acc[categoryKey].push(productPlain);
        return acc;
      }, {});

      const response = Object.entries(grouped)
        .map(([categoryName, items]) => ({
          category: categoryName,
          products: items,
        }))
        .sort((a, b) => a.category.localeCompare(b.category));

      return res.json({
        total: products.count,
        page,
        limit,
        data: response,
      });
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getFresh(req, res, next) {
    try {
      const limit = 12;

      const products = await Product.findAll({
        where: { isDeleted: false, count: {[Op.ne]: 0} },
        order: [['createdAt', 'DESC']],
        attributes: ["id", "name", "link", "images", "price", "count", "ebayStock", "ebayModel", "ebayCategory"],
        limit,
      });

      return res.json(products);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async getProduct(req, res, next) {
    try {
      const link = req.query.link || req.params.link;

      if (!link) {
        return next(ApiError.badRequest('Product link is required'));
      }

      const product = await Product.findOne({
        where: { link, isDeleted: false },
        include: [
          {
            model: Category,
            include: [
              {
                model: Category,
                as: 'parentCategory',
                required: false,
              },
            ],
          },
        ],
      });

      if (!product) {
        return next(ApiError.badRequest('Product not found'));
      }

      return res.json(product);
    } catch (e) {
      next(ApiError.badRequest(e.message));
    }
  }

  async fetch(req, res, next) {
    try {
      let {page, limit, categoryId, regions} = req.query

      page = page || 1
      limit = limit || 100
      let offset = page * limit - limit

      let categories = []

      if (categoryId) {
        categories = await Category.findAll({
          where: {
            isDeleted: false,
            count: {[Op.ne]: 0},
            [Op.or]: [{id: categoryId}, {parentId: categoryId}]
          }
        })
      }

      const categoryIds = categories?.map((category) => category.id) || []
      const regionsArray = !!regions ? JSON.parse(decodeURIComponent(regions)) : [];
      const products = await Product.findAndCountAll({
        where: {
          ...(!!regionsArray?.length ? {region: {[Op.in]: regionsArray}} : {}),
          isDeleted: false,
          count: {[Op.ne]: 0},
          ...(categoryId ? {categoryId: {[Op.in]: categoryIds}} : {}),
        },
        limit, offset, order: [['name', 'ASC']], include: [{model: Category}]
      })

      if (categories.length > 0) {
        products.category = categories[categories.length - 1]
      }

      return res.json(products)
    } catch (e) {
      console.log('/////', e)
      next(ApiError.badRequest(e.message))
    }
  }

  async fetchOne(req, res, next) {
    try {
      const {link} = req.params;

      const product = await Product.findOne({where: {link}});

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
      const files = req.files?.files;
      const {
        name, description, link, price, old_price, categoryId,
        about, weight, variation, processing, fermentation,
        region, farmer, keyDescriptor
      } = JSON.parse(req.body.data);

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
        images: filesData
      });

      return res.json(product)
    } catch (e) {
      console.log(e)
      next(ApiError.badRequest(e.message));
    }
  }

  // async update(req, res, next) {
  //   try {
  //     const files = req.files?.files;
  //     const {id} = req.query;
  //     const {
  //       name, description, link, price, old_price, categoryId,
  //       about, weight, variation, processing, fermentation,
  //       region, farmer, keyDescriptor
  //     } = JSON.parse(req.body.data);

  //     let filesPromises = []

  //     if (files && files.length > 0) {
  //       filesPromises = files.map(async (file) => {
  //         if (file) {
  //           // Загрузка оригинального изображения
  //           const upload = await s3.Upload({buffer: file.data}, '/products/');
  //           const imageUrl = upload.Key;

  //           const previewBuffer = await sharp(file.data)
  //             .resize(24, 24)
  //             .toBuffer();

  //           // Загрузка миниатюры на S3
  //           const previewUpload = await s3.Upload({buffer: previewBuffer}, '/products/previews/');
  //           const previewUrl = previewUpload.Key;

  //           return {imageUrl, previewUrl}
  //         }
  //       });
  //     }

  //     const filesData = await Promise.all(filesPromises);

  //     const product = await Product.update({
  //       name,
  //       description,
  //       link,
  //       price,
  //       old_price,
  //       categoryId,
  //       about,
  //       weight,
  //       variation,
  //       processing,
  //       fermentation,
  //       region,
  //       farmer,
  //       keyDescriptor,
  //       images: filesData
  //     }, {where: {id}});

  //     return res.json(product)
  //   } catch (e) {
  //     console.log(e)
  //     next(ApiError.badRequest(e.message));
  //   }
  // }

  // async delete(req, res, next) {
  //   try {
  //     let {id} = req.query;
  //     await Product.update({isDeleted: true}, {where: {id}})
  //     return res.json("Deleted successfully");
  //   } catch (e) {
  //     next(ApiError.badRequest(e.message))
  //   }
  // }
}

module.exports = new ProductController()
