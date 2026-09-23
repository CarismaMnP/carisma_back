const { DataTypes: D } = require('sequelize');
module.exports = sequelize => ({
  CarpartsJob: sequelize.define(
    'carparts_job',
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      orderId: D.UUID,
      productId: D.INTEGER,
      guid: { type: D.STRING(36), unique: true },
      inventoryId: D.STRING,
      tag: D.STRING,
      state: { type: D.STRING, defaultValue: 'pending' },
      attempts: { type: D.INTEGER, defaultValue: 0 },
      nextAttemptAt: { type: D.DATE, defaultValue: D.NOW },
      result: D.JSONB,
      lastError: D.TEXT,
    },
    { tableName: 'carparts_jobs' },
  ),
  CarpartsSyncState: sequelize.define(
    'carparts_sync_state',
    { id: { type: D.STRING, primaryKey: true }, data: { type: D.JSONB, defaultValue: {} } },
    { tableName: 'carparts_sync_states' },
  ),
  CarpartsImage: sequelize.define(
    'carparts_image',
    {
      id: { type: D.STRING(64), primaryKey: true },
      guid: D.STRING(36),
      source: D.JSONB,
      url: D.TEXT,
      sha256: D.STRING(64),
      bytes: D.INTEGER,
      attempts: { type: D.INTEGER, defaultValue: 0 },
      lastError: D.TEXT,
      nextAttemptAt: { type: D.DATE, defaultValue: D.NOW },
    },
    { tableName: 'carparts_images' },
  ),
});
