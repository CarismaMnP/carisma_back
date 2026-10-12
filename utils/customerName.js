const {Op, fn, col, where} = require('sequelize');
const {User} = require('../models/models');

// An order must belong to the same account/email. Never overwrite a chosen profile name.
async function fillMissingCustomerName(order, transaction) {
  const name = String(order.fullName || '').trim().replace(/\s+/g, ' ').slice(0, 255);
  const mail = String(order.mail || '').trim().toLowerCase();
  if (!name || !mail || !order.userId || order.isIntegrationTest) return;
  await User.update({name}, {
    where: {
      id: order.userId,
      [Op.and]: [
        where(fn('lower', fn('trim', col('mail'))), mail),
        where(fn('trim', fn('coalesce', col('name'), '')), ''),
      ],
    }, transaction,
  });
}
module.exports = {fillMissingCustomerName};
