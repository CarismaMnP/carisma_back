const {DataTypes: D} = require('sequelize');
module.exports = s => ({
  ResaleApplication: s.define('resaleApplication', {
    id: {type:D.UUID,defaultValue:D.UUIDV4,primaryKey:true},
    userId: {type:D.INTEGER,allowNull:false},
    companyName: {type:D.STRING(200),allowNull:false},
    status: {type:D.STRING(20),allowNull:false,defaultValue:'pending'},
    fileName: {type:D.STRING(200),allowNull:false},
    mimeType: {type:D.STRING(100),allowNull:false},
    fileSize: {type:D.INTEGER,allowNull:false},
    sha256: {type:D.STRING(64),allowNull:false},
    // Private evidence is part of the database backup, never the public image bucket.
    documentData: {type:D.BLOB,allowNull:false},
    reviewComment: D.TEXT,
    reviewedBy: D.INTEGER,
    reviewedAt: D.DATE,
  }, {tableName:'resale_applications',defaultScope:{attributes:{exclude:['documentData']}}}),
  ResaleReview: s.define('resaleReview', {
    id: {type:D.UUID,defaultValue:D.UUIDV4,primaryKey:true},
    applicationId: {type:D.UUID,allowNull:false},
    actorId: {type:D.INTEGER,allowNull:false},
    fromStatus: {type:D.STRING(20),allowNull:false},
    toStatus: {type:D.STRING(20),allowNull:false},
    comment: D.TEXT,
  }, {tableName:'resale_reviews',updatedAt:false}),
});
