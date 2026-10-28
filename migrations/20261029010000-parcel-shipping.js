'use strict';
module.exports={
 async up(q,S){await q.sequelize.transaction(async transaction=>{
  const o={transaction};
  await q.addColumn('products','parcelPackage',{type:S.JSONB},o);
  await q.addColumn('orders','parcelQuoteId',{type:S.UUID},o);
  await q.addColumn('orders','parcelSnapshot',{type:S.JSONB},o);
  await q.createTable('parcel_quotes',{
   id:{type:S.UUID,primaryKey:true,allowNull:false},userId:{type:S.INTEGER,allowNull:false},status:{type:S.STRING,allowNull:false},
   fingerprint:{type:S.STRING(64),allowNull:false},environment:{type:S.STRING,allowNull:false},request:{type:S.JSONB,allowNull:false},
   result:S.JSONB,amountCents:S.INTEGER,expiresAt:S.DATE,error:S.TEXT,
   createdAt:{type:S.DATE,allowNull:false},updatedAt:{type:S.DATE,allowNull:false},
  },o);
  await q.addIndex('parcel_quotes',['userId','createdAt'],o);await q.addIndex('parcel_quotes',['fingerprint'],o);
  await q.sequelize.query(`UPDATE products SET make='BMW' WHERE UPPER(TRIM(make))='BAVARIAN MOTOR WORKS (BMW)'`,o);
 });},
 async down(){throw Error('Shipping and payment history must be retained. Use a forward migration.');},
};
