'use strict';
module.exports = {
 async up(q, S) {
  await q.sequelize.transaction(async transaction => {
   const opts={transaction};
   const product={
    source:{type:S.STRING,allowNull:false,defaultValue:'manual'},
    carpartsGuid:{type:S.STRING(36),allowNull:true},carpartsInventoryId:{type:S.STRING,allowNull:true},carpartsTag:{type:S.STRING,allowNull:true},
    carpartsHash:{type:S.STRING(64),allowNull:true},carpartsData:{type:S.JSONB,allowNull:true},sourceCount:{type:S.INTEGER,allowNull:true},
    sourceMissing:{type:S.BOOLEAN,allowNull:false,defaultValue:false},websiteSold:{type:S.BOOLEAN,allowNull:false,defaultValue:false},
    adminHidden:{type:S.BOOLEAN,allowNull:false,defaultValue:false},imagesHash:{type:S.STRING(64),allowNull:true},
   };
   for(const [name,def] of Object.entries(product)) await q.addColumn('products',name,def,opts);
   await q.addIndex('products',['carpartsGuid'],{unique:true,name:'products_carparts_guid_unique',...opts});
   await q.sequelize.query(`UPDATE products SET source=CASE WHEN "isManual" OR ("ebayItemId" IS NULL AND "ebayLegacyId" IS NULL) THEN 'manual' ELSE 'legacy' END`,opts);
   await q.sequelize.query(`UPDATE products SET "isManual"=true WHERE source='manual'`,opts);
   for(const name of ['stockReservedAt','reservationExpiresAt','stockReleasedAt','stockAppliedAt','paidAt']) await q.addColumn('orders',name,{type:S.DATE,allowNull:true},opts);
   await q.addColumn('orders','paidLive',{type:S.BOOLEAN,allowNull:false,defaultValue:false},opts);
   await q.addColumn('orders','checkoutSessionId',{type:S.STRING,allowNull:true},opts);
   // Historical payments must never be replayed into Checkmate or debit stock again.
   await q.sequelize.query(`UPDATE orders SET "stockAppliedAt"="updatedAt" WHERE state IN ('confirmed','delivery','delivered','completed','refunded','disputed')`,opts);
   await q.createTable('carparts_jobs',{
    id:{type:S.UUID,primaryKey:true,allowNull:false},orderId:{type:S.UUID,allowNull:false,references:{model:'orders',key:'id'}},
    productId:{type:S.INTEGER,allowNull:false,references:{model:'products',key:'id'}},guid:{type:S.STRING(36),allowNull:false,unique:true},
    inventoryId:{type:S.STRING,allowNull:false},tag:{type:S.STRING,allowNull:false},
    state:{type:S.STRING,allowNull:false,defaultValue:'pending'},attempts:{type:S.INTEGER,allowNull:false,defaultValue:0},
    nextAttemptAt:{type:S.DATE,allowNull:false},result:{type:S.JSONB,allowNull:true},lastError:{type:S.TEXT,allowNull:true},
    createdAt:{type:S.DATE,allowNull:false},updatedAt:{type:S.DATE,allowNull:false}
   },opts);
   await q.addIndex('carparts_jobs',['state','nextAttemptAt'],opts);
   await q.createTable('carparts_sync_states',{
    id:{type:S.STRING,primaryKey:true},data:{type:S.JSONB,allowNull:false,defaultValue:{}},
    createdAt:{type:S.DATE,allowNull:false},updatedAt:{type:S.DATE,allowNull:false}
   },opts);
   await q.createTable('carparts_images',{
    id:{type:S.STRING(64),primaryKey:true},guid:{type:S.STRING(36),allowNull:false},source:{type:S.JSONB,allowNull:false},
    url:{type:S.TEXT,allowNull:true},sha256:{type:S.STRING(64),allowNull:true},bytes:{type:S.INTEGER,allowNull:true},
    attempts:{type:S.INTEGER,allowNull:false,defaultValue:0},lastError:{type:S.TEXT,allowNull:true},nextAttemptAt:{type:S.DATE,allowNull:false},
    createdAt:{type:S.DATE,allowNull:false},updatedAt:{type:S.DATE,allowNull:false}
   },opts);
   await q.addIndex('carparts_images',['guid'],opts);
   await q.addIndex('carparts_images',['nextAttemptAt'],opts);
  });
 },
 async down(){throw new Error('CarParts migration is additive. Restore a verified backup for rollback; do not drop sync identities or paid-order history.');}
};
