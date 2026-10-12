'use strict';
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      const opts = {transaction};
      const fields = {
        isIntegrationTest: {type: S.BOOLEAN, allowNull: false, defaultValue: false},
        shippingAmount: {type: S.DECIMAL(12, 2), defaultValue: 0},
        billingAddress: {type: S.JSONB}, shippingAddress: {type: S.JSONB},
        checkmatePayload: {type: S.JSONB}, checkmateWorkOrder: {type: S.STRING}, checkmateInvoice: {type: S.STRING},
      };
      for (const [key, definition] of Object.entries(fields)) await q.addColumn('orders', key, definition, opts);
      await q.addColumn('orderProducts', 'unitPriceCents', {type: S.INTEGER}, opts);
      await q.addColumn('orderProducts', 'productSnapshot', {type: S.JSONB}, opts);
      // Historical line prices cannot be reconstructed from today's catalog. Leave them unknown.
      await q.sequelize.query(`WITH names AS (
        SELECT DISTINCT ON (o."userId") o."userId", LEFT(REGEXP_REPLACE(TRIM(o."fullName"), '\\s+', ' ', 'g'),255) AS name
        FROM orders o JOIN users u ON u.id=o."userId"
        WHERE NULLIF(TRIM(o."fullName"),'') IS NOT NULL
          AND LOWER(TRIM(o.mail))=LOWER(TRIM(u.mail))
          AND o.state IN ('confirmed','delivery','delivered','completed','refunded')
        ORDER BY o."userId", o."createdAt" DESC, o.id
      ) UPDATE users u SET name=n.name, "updatedAt"=NOW() FROM names n
        WHERE u.id=n."userId" AND COALESCE(TRIM(u.name),'')=''`, opts);
    });
  },
  async down() {throw Error('Preserve posted invoice identities and immutable order snapshots; rollback code without dropping financial history.');},
};
