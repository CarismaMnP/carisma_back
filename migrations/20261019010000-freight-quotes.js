'use strict';
module.exports = {
  async up(q,S) {
    await q.sequelize.transaction(async transaction => {
      const o={transaction};
      await q.addColumn('products','carpartsPartCode',{type:S.STRING(16)},o);
      await q.addColumn('products','freightCategoryCode',{type:S.STRING(16)},o);
      await q.sequelize.query(`UPDATE products SET "carpartsPartCode"=UPPER(TRIM("carpartsData"->>'part')) WHERE source='carparts'`,o);
      // Exact existing manual category, not title matching. Checkmate never owns this field.
      await q.sequelize.query(`UPDATE products SET "freightCategoryCode"='ENG' WHERE source='manual' AND lower(trim("ebayCategory")) IN ('engine','engines','engine assembly/motor')`,o);
      for (const [name,type] of Object.entries({freightQuoteId:S.UUID,freightSnapshot:S.JSONB,freightAddress:S.JSONB,
        shippingExpectedCents:S.INTEGER,stripeCustomerId:S.STRING,shippingReview:S.STRING})) await q.addColumn('orders',name,{type},o);
      await q.createTable('freight_quotes',{
        id:{type:S.UUID,primaryKey:true,allowNull:false},userId:{type:S.INTEGER,allowNull:false},
        status:{type:S.STRING,allowNull:false},fingerprint:{type:S.STRING(64),allowNull:false},request:{type:S.JSONB,allowNull:false},
        result:{type:S.JSONB},amountCents:{type:S.INTEGER},expiresAt:{type:S.DATE},error:{type:S.TEXT},
        createdAt:{type:S.DATE,allowNull:false},updatedAt:{type:S.DATE,allowNull:false},
      },o);
      await q.addIndex('freight_quotes',['userId','createdAt'],o);
      await q.addIndex('freight_quotes',['fingerprint'],o);
    });
  },
  async down() {throw Error('Freight quote and payment history must be retained; deploy a forward migration.');},
};
