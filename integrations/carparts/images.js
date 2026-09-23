const { Op, literal } = require('sequelize');
const sharp = require('sharp');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { sequelize, s3, bucketName } = require('../../db');
const { CarpartsImage, CarpartsSyncState } = require('../../models/models');
const { bridge } = require('./transport');
const { hash } = require('./normalize');
const { withLock } = require('./lock');
const { publishReadyImages } = require('./catalog');
async function transferImages(shard = 0) {
  if (!Number.isInteger(shard) || shard < 0 || shard > 7) throw Error('Invalid image worker');
  return withLock(9032010 + shard, async () => {
    const groups = ['01', '23', '45', '67', '89', 'ab', 'cd', 'ef'];
    const rows = await CarpartsImage.findAll({
      where: {
        url: null,
        nextAttemptAt: { [Op.lte]: new Date() },
        [Op.and]: literal(
          `substring(id, 1, 1) IN (${[...groups[shard]].map(x => `'${x}'`).join(',')})`,
        ),
      },
      order: [
        ['attempts', 'ASC'],
        [
          literal(`CASE WHEN source->>'PrimaryImage'=source->>'ImageNumber' THEN 1 ELSE 0 END`),
          'DESC',
        ],
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: 24,
    });
    if (!rows.length) return { processed: 0 };
    const direct = process.env.CARPARTS_IMAGE_DIRECT === 'true';
    const requests = await Promise.all(
      rows.map(async row =>
        direct
          ? {
              ...row.source,
              uploadUrl: await getSignedUrl(
                s3,
                new PutObjectCommand({
                  Bucket: bucketName,
                  Key: `carparts/9032/${row.guid}/${row.id}.jpg`,
                  ContentType: 'image/jpeg',
                }),
                { expiresIn: 600 },
              ),
            }
          : row.source,
      ),
    );
    const result = await bridge(
      { action: direct ? 'uploadImages' : 'images', images: requests },
      { timeout: 180000 },
    );
    if (!result.ok || !Array.isArray(result.images)) throw Error('Incomplete image response');
    const updates = [];
    const received = new Map(result.images.map(x => [x.id, x]));
    let copied = 0,
      errors = 0;
    for (let i = 0; i < rows.length; i += 4)
      await Promise.all(
        rows.slice(i, i + 4).map(async row => {
          try {
            const image = received.get(row.id);
            if (!image || image.error) throw Error(image?.error || 'No image returned');
            const base = (
              process.env.CARPARTS_S3_PUBLIC_URL ||
              'https://pub-bc3786b523da4133a78648b83b419424.r2.dev'
            ).replace(/\/$/, '');
            if (direct) {
              if (!/^[a-f0-9]{64}$/.test(image.sha256) || !(image.bytes > 0))
                throw Error('Invalid upload receipt');
              updates.push({
                id: row.id,
                attempts: row.attempts,
                nextAttemptAt: row.nextAttemptAt,
                url: `${base}/carparts/9032/${row.guid}/${row.id}.jpg`,
                sha256: image.sha256,
                bytes: image.bytes,
                lastError: null,
              });
              copied++;
              return;
            }
            const original = Buffer.from(image.data, 'base64');
            if (hash(original) !== image.sha256) throw Error('Image checksum mismatch');
            const data = await sharp(original, { limitInputPixels: 80000000 })
              .rotate()
              .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 88, mozjpeg: true })
              .toBuffer();
            const key = `carparts/9032/${row.guid}/${image.sha256}.jpg`;
            await s3.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: data,
                ContentType: 'image/jpeg',
                CacheControl: 'public, max-age=31536000, immutable',
              }),
            );
            updates.push({
              id: row.id,
              attempts: row.attempts,
              nextAttemptAt: row.nextAttemptAt,
              url: `${base}/${key}`,
              sha256: hash(data),
              bytes: data.length,
              lastError: null,
            });
            copied++;
          } catch (e) {
            errors++;
            updates.push({
              id: row.id,
              attempts: row.attempts + 1,
              lastError: e.message.slice(0, 1000),
              nextAttemptAt: new Date(
                Date.now() + Math.min(21600000, 60000 * 2 ** Math.min(row.attempts, 9)),
              ),
            });
          }
        }),
      );
    // Persist a batch with one commit; replaying an unacknowledged upload writes
    // the same immutable object key. Do not resurrect retired image manifests.
    if (updates.length)
      await sequelize.query(
        `UPDATE carparts_images AS i SET url=d.url,sha256=d.sha256,bytes=d.bytes,attempts=d.attempts,"lastError"=d."lastError","nextAttemptAt"=d."nextAttemptAt","updatedAt"=NOW() FROM jsonb_to_recordset($1::jsonb) AS d(id text,url text,sha256 text,bytes integer,attempts integer,"lastError" text,"nextAttemptAt" timestamptz) WHERE i.id=d.id AND i.url IS NULL`,
        { bind: [JSON.stringify(updates)] },
      );
    return { processed: rows.length, copied, errors, timing: result.timing };
  });
}
async function imageStatus() {
  const [total, ready, failed] = await Promise.all([
    CarpartsImage.count(),
    CarpartsImage.count({ where: { url: { [Op.ne]: null } } }),
    CarpartsImage.count({ where: { url: null, lastError: { [Op.ne]: null } } }),
  ]);
  const data = { total, ready, failed, updatedAt: new Date().toISOString() };
  await CarpartsSyncState.upsert({ id: 'images', data });
  await publishReadyImages();
  return data;
}
module.exports = { transferImages, imageStatus };
