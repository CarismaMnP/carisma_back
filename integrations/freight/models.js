const {DataTypes:D} = require('sequelize');
module.exports = sequelize => ({FreightQuote:sequelize.define('freight_quote',{
  id:{type:D.UUID,defaultValue:D.UUIDV4,primaryKey:true}, userId:{type:D.INTEGER,allowNull:false},
  status:{type:D.STRING,allowNull:false}, fingerprint:{type:D.STRING(64),allowNull:false},
  request:{type:D.JSONB,allowNull:false}, result:D.JSONB, amountCents:D.INTEGER,
  expiresAt:D.DATE, error:D.TEXT,
},{tableName:'freight_quotes',indexes:[{fields:['userId','createdAt']},{fields:['fingerprint']} ]})});
