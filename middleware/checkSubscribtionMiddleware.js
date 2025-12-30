const { Tenant } = require('../models/models');

module.exports = function () {
  return async function (req, res, next) {
    if (req.method === 'OPTIONS') next();
    try {
      const { user: requestedUser } = req;

      const tenant = await Tenant.findOne({ where: { id: requestedUser?.tenantId } });
      if (tenant?.subscribtionType === 'expired')
        return res.status(403).json({ message: 'У Вас закончилась активная подписка' });

      next();
    } catch (e) {
      res.status(403).json({ message: 'Ошибка при проверке подписки' });
    }
  };
};
