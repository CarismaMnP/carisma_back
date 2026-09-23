const { Op } = require('sequelize');
const { Product, CarpartsJob, CarpartsImage, CarpartsSyncState } = require('../../models/models');
async function getStatus() {
  const [
    states,
    pendingJobs,
    reviewJobs,
    recentJobs,
    carpartsAvailable,
    manualAvailable,
    legacyAvailable,
    imagesReady,
    imagesPending,
    imagesFailed,
  ] = await Promise.all([
    CarpartsSyncState.findAll({ raw: true }),
    CarpartsJob.count({ where: { state: { [Op.in]: ['pending', 'retry', 'processing'] } } }),
    CarpartsJob.count({ where: { state: 'review' } }),
    CarpartsJob.findAll({
      order: [['updatedAt', 'DESC']],
      limit: 20,
      attributes: [
        'id',
        'orderId',
        'productId',
        'guid',
        'state',
        'attempts',
        'lastError',
        'updatedAt',
      ],
    }),
    Product.count({ where: { source: 'carparts', count: { [Op.gt]: 0 }, isDeleted: false } }),
    Product.count({ where: { source: 'manual', count: { [Op.gt]: 0 }, isDeleted: false } }),
    Product.count({ where: { source: 'legacy', count: { [Op.gt]: 0 }, isDeleted: false } }),
    CarpartsImage.count({ where: { url: { [Op.ne]: null } } }),
    CarpartsImage.count({ where: { url: null } }),
    CarpartsImage.count({ where: { url: null, lastError: { [Op.ne]: null } } }),
  ]);
  const catalog = states.find(x => x.id === 'catalog')?.data;
  return {
    catalog,
    stale: !catalog?.finishedAt || Date.now() - Date.parse(catalog.finishedAt) > 15 * 60000,
    carpartsAvailable,
    manualAvailable,
    legacyAvailable,
    images: { ready: imagesReady, pending: imagesPending, failed: imagesFailed },
    sales: {
      enabled: process.env.CARPARTS_SALES_ENABLED === 'true',
      pending: pendingJobs,
      review: reviewJobs,
      recent: recentJobs,
    },
    states,
  };
}
module.exports = { getStatus };
