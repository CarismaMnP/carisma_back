'use strict';
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      const o = { transaction };
      await q.addColumn('products', 'carpartsPriceCents', { type: S.INTEGER }, o);
      await q.addColumn('products', 'priceOverrideCents', { type: S.INTEGER }, o);
      await q.sequelize.query(
        'UPDATE products SET "carpartsPriceCents"=ROUND(price::numeric*100)::integer WHERE source=\'carparts\' AND price>=0 AND price<1000000',
        o,
      );
      await q.addColumn('orders', 'promoCode', { type: S.STRING(40) }, o);
      await q.addColumn('orders', 'promoId', { type: S.UUID }, o);
      await q.addColumn(
        'orders',
        'discountCents',
        { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        o,
      );
      await q.addColumn(
        'orderProducts',
        'discountCents',
        { type: S.INTEGER, allowNull: false, defaultValue: 0 },
        o,
      );
      await q.createTable(
        'price_change_batches',
        {
          id: { type: S.UUID, primaryKey: true },
          userId: { type: S.INTEGER, allowNull: false },
          state: { type: S.STRING, allowNull: false, defaultValue: 'preview' },
          operation: { type: S.JSONB, allowNull: false },
          rows: { type: S.JSONB, allowNull: false },
          expiresAt: { type: S.DATE, allowNull: false },
          appliedAt: S.DATE,
          createdAt: { type: S.DATE, allowNull: false },
          updatedAt: { type: S.DATE, allowNull: false },
        },
        o,
      );
      await q.createTable(
        'promo_codes',
        {
          id: { type: S.UUID, primaryKey: true },
          code: { type: S.STRING(40), allowNull: false, unique: true },
          kind: { type: S.STRING, allowNull: false },
          value: { type: S.INTEGER, allowNull: false },
          minSubtotalCents: { type: S.INTEGER, allowNull: false, defaultValue: 0 },
          maxUses: S.INTEGER,
          startsAt: S.DATE,
          endsAt: S.DATE,
          active: { type: S.BOOLEAN, allowNull: false, defaultValue: true },
          createdAt: { type: S.DATE, allowNull: false },
          updatedAt: { type: S.DATE, allowNull: false },
        },
        o,
      );
      await q.addIndex('orders', ['promoId'], o);
    });
  },
  async down(q) {
    await q.sequelize.transaction(async transaction => {
      const o = { transaction };
      await q.dropTable('price_change_batches', o);
      await q.dropTable('promo_codes', o);
      for (const c of ['promoCode', 'promoId', 'discountCents'])
        await q.removeColumn('orders', c, o);
      await q.removeColumn('orderProducts', 'discountCents', o);
      for (const c of ['carpartsPriceCents', 'priceOverrideCents'])
        await q.removeColumn('products', c, o);
    });
  },
};
