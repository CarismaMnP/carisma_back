const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { Sequelize } = require("sequelize");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const env = process.env.NODE_ENV || "local";
const env_file = ".env." + env
require("dotenv").config({ path: env_file });

const db_uri = `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;



const sequelize = new Sequelize(db_uri, {
    dialect: "postgres",
    protocol: "postgres",
    dialectOptions: {
        ssl: process.env.YANDEX_DB_CERT_PATH
            ? {
                require: true,
                rejectUnauthorized: true,
                ca: fs
                    .readFileSync(process.env.YANDEX_DB_CERT_PATH)
                    .toString(),
            }
            : undefined,
    },
});

const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_S3_URL,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_S3_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_S3_KEY_SECRET,
    },
});

const bucketName = process.env.S3_BUCKET || process.env.CLOUDFLARE_S3_BUCKET || 'my-bucket';

const normalizeFolder = (folder) => {
    if (!folder) return '';
    let normalized = folder;
    if (normalized.startsWith('/')) normalized = normalized.slice(1);
    if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized;
};

// Mimics EasyYandexS3.Upload interface used across controllers
s3.Upload = async function Upload({ buffer, mimetype, name }, folder = '') {
    if (!buffer) {
        throw new Error('Upload buffer is required');
    }

    const normalizedFolder = normalizeFolder(folder);
    const ext = path.extname(name || '') || '';
    const Key = normalizedFolder
        ? `${normalizedFolder}/${uuidv4()}${ext}`
        : `${uuidv4()}${ext}`;

    await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key,
        Body: buffer,
        ContentType: mimetype || 'application/octet-stream',
    }));

    return { Key };
};

// s3.send(new PutObjectCommand({
//     Bucket: "my-bucket",
//     Key: "hello.txt",
//     Body: "hi from R2",
// }));


module.exports = { sequelize, s3, bucketName };
