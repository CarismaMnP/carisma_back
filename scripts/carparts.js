require('../utils/loadEnvironment');
const fs = require('fs');
const { sequelize } = require('../db');
(async () => {
  const command = process.argv[2];
  let result;
  if (command === 'stage' || command === 'sync')
    result = await require('../integrations/carparts/catalog').syncCatalog({
      stageOnly: command === 'stage',
      snapshot: process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3])) : undefined,
    });
  else if (command === 'images')
    result = await require('../integrations/carparts/images').transferImages();
  else if (command === 'status')
    result = await require('../integrations/carparts/status').getStatus();
  else if (command === 'audit-sale') {
    const { Product } = require('../models/models');
    const product = await Product.findOne({ where: { carpartsGuid: process.argv[3] } });
    if (!product) throw Error('Unknown source product');
    result = await require('../integrations/carparts/transport').bridge({
      action: 'auditSale',
      guid: product.carpartsGuid,
      inventoryId: product.carpartsInventoryId,
      tag: product.carpartsTag,
      orderId: '00000000-0000-0000-0000-000000000000',
    });
  } else throw Error('Usage: carparts.js stage|sync [snapshot.json]|images|status|audit-sale GUID');
  console.log(JSON.stringify(result));
  await sequelize.close();
})().catch(async e => {
  console.error(e.message);
  await sequelize.close();
  process.exitCode = 1;
});
