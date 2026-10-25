const { DataTypes: D } = require('sequelize');
module.exports = s => ({
  PriceChangeBatch: s.define(
    'priceChangeBatch',
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      userId: { type: D.INTEGER, allowNull: false },
      state: { type: D.STRING, defaultValue: 'preview' },
      operation: D.JSONB,
      rows: D.JSONB,
      expiresAt: D.DATE,
      appliedAt: D.DATE,
    },
    { tableName: 'price_change_batches' },
  ),
  PromoCode: s.define(
    'promoCode',
    {
      id: { type: D.UUID, defaultValue: D.UUIDV4, primaryKey: true },
      code: { type: D.STRING(40), unique: true, allowNull: false },
      kind: D.STRING,
      value: D.INTEGER,
      minSubtotalCents: { type: D.INTEGER, defaultValue: 0 },
      maxUses: D.INTEGER,
      startsAt: D.DATE,
      endsAt: D.DATE,
      active: { type: D.BOOLEAN, defaultValue: true },
    },
    { tableName: 'promo_codes' },
  ),
});
