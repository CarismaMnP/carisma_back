const { Op } = require('sequelize');
const { sequelize } = require('../../db');
const { Product, CarpartsImage, CarpartsSyncState } = require('../../models/models');
const { validateSnapshot, normalizeSnapshot } = require('./normalize');
const { bridge } = require('./transport');
const { withLock } = require('./lock');
const slug = s =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'part';
async function reservedCount(productId, transaction) {
  const [rows] = await sequelize.query(
    `SELECT COALESCE(SUM(op.count),0)::int AS n FROM "orderProducts" op JOIN orders o ON o.id=op."orderId" WHERE op."productId"=:id AND o."stockReservedAt" IS NOT NULL AND o."stockAppliedAt" IS NULL AND o."stockReleasedAt" IS NULL`,
    { replacements: { id: productId }, transaction },
  );
  return rows[0].n;
}
async function stageImages(items) {
  const unique = new Map();
  for (const item of items)
    if (item.data.available)
      for (const photo of item.data.photos)
        unique.set(photo.id, { id: photo.id, guid: item.guid, source: photo });
  const stored = await CarpartsImage.findAll({ attributes: ['id', 'url'], raw: true });
  const retired = stored.filter(x => !x.url && !unique.has(x.id)).map(x => x.id);
  for (let i = 0; i < retired.length; i += 500)
    await CarpartsImage.destroy({
      where: { id: { [Op.in]: retired.slice(i, i + 500) }, url: null },
    });
  const existing = new Set(stored.map(x => x.id));
  const rows = [...unique.values()].filter(x => !existing.has(x.id));
  for (let i = 0; i < rows.length; i += 500)
    await CarpartsImage.bulkCreate(rows.slice(i, i + 500), { ignoreDuplicates: true });
  return unique.size;
}
async function syncCatalog({ snapshot, stageOnly = false } = {}) {
  return withLock(9032001, async () => {
    const previous = await CarpartsSyncState.findByPk('catalog');
    const source = snapshot || (await bridge({ action: 'catalog', migration: !previous }));
    const guids = validateSnapshot(source, previous?.data?.sourceRows || 0);
    const items = normalizeSnapshot(source);
    const images = await stageImages(items);
    const stats = {
      startedAt: source.startedAt,
      sourceRows: items.length,
      available: items.filter(x => x.data.available).length,
      images,
      missingImageFiles: source.missingImages?.length || 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      missing: 0,
      reasons: {},
    };
    for (const x of items) stats.reasons[x.data.reason] = (stats.reasons[x.data.reason] || 0) + 1;
    if (stageOnly) {
      await CarpartsSyncState.upsert({
        id: 'staging',
        data: { ...stats, finishedAt: new Date().toISOString() },
      });
      return stats;
    }
    const products = await Product.findAll({
      attributes: [
        'id',
        'source',
        'isManual',
        'carpartsGuid',
        'ebayLegacyId',
        'count',
        'isDeleted',
        'carpartsHash',
        'imagesHash',
        'sourceMissing',
      ],
      raw: true,
    });
    const byGuid = new Map(products.filter(p => p.carpartsGuid).map(p => [p.carpartsGuid, p.id]));
    const byId = new Map(products.map(p => [p.id, p]));
    const byLegacy = new Map(
      products
        .filter(p => !p.isManual && !p.carpartsGuid && p.ebayLegacyId)
        .map(p => [p.ebayLegacyId, p]),
    );
    const urls = new Map(
      (
        await CarpartsImage.findAll({
          where: { url: { [Op.ne]: null } },
          attributes: ['id', 'url'],
          raw: true,
        })
      ).map(x => [x.id, x.url]),
    );
    for (const item of items) {
      const candidates = [
        ...new Map(
          item.legacyIds
            .map(x => byLegacy.get(x))
            .filter(Boolean)
            .map(p => [p.id, p]),
        ).values(),
      ].sort(
        (a, b) =>
          Number(b.count > 0 && !b.isDeleted) - Number(a.count > 0 && !a.isDeleted) || b.id - a.id,
      );
      let id = byGuid.get(item.guid) || candidates[0]?.id;
      if (!id && !item.data.available) continue;
      const previousProduct = byId.get(id);
      const photoUrls = item.data.photos.map(x => urls.get(x.id));
      const photosReady = photoUrls.every(Boolean);
      // An unchanged source needs no row lock or stock rewrite. Website
      // reservations and payments own their current local stock value.
      if (
        previousProduct?.source === 'carparts' &&
        !previousProduct.isManual &&
        previousProduct.carpartsGuid === item.guid &&
        previousProduct.carpartsHash === item.hash &&
        !previousProduct.sourceMissing &&
        (!photosReady || previousProduct.imagesHash === item.imagesHash)
      ) {
        stats.unchanged++;
        continue;
      }
      await sequelize.transaction(async transaction => {
        let product = id
          ? await Product.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })
          : null;
        if (product?.isManual || (product?.source === 'manual' && !product.ebayLegacyId))
          throw Error(`Manual product collision ${id}`);
        if (product?.carpartsGuid && product.carpartsGuid !== item.guid)
          throw Error(`Ambiguous migration match ${id}`);
        const reserved = product ? await reservedCount(product.id, transaction) : 0;
        const count =
          item.data.available && !product?.websiteSold && !product?.adminHidden
            ? Math.max(0, 1 - reserved)
            : 0;
        if (
          product?.carpartsHash === item.hash &&
          !product.sourceMissing &&
          product.count === count &&
          (!photosReady || product.imagesHash === item.imagesHash)
        ) {
          stats.unchanged++;
          return;
        }
        const payload = {
          ...item.fields,
          source: 'carparts',
          isManual: false,
          carpartsGuid: item.guid,
          carpartsInventoryId: item.data.inventoryId,
          carpartsTag: item.data.tag,
          carpartsHash: item.hash,
          carpartsData: item.data,
          sourceCount: item.data.available ? 1 : 0,
          sourceMissing: false,
          count,
          ebayStock: item.data.available ? 1 : 0,
        };
        // Preserve previously curated category labels/fitment and all existing URLs and IDs.
        if (product?.ebayCategory) payload.ebayCategory = product.ebayCategory;
        if (product?.additionalFields?.localizedAspects) {
          const current = payload.additionalFields.localizedAspects;
          const names = new Set(current.map(x => x.name));
          payload.additionalFields = {
            ...product.additionalFields,
            localizedAspects: [
              ...product.additionalFields.localizedAspects.filter(x => !names.has(x.name)),
              ...current,
            ],
          };
        }
        if (photosReady) {
          payload.images = photoUrls;
          payload.imagesHash = item.imagesHash;
        }
        if (product) {
          await product.update(payload, { transaction });
          stats.updated++;
        } else {
          product = await Product.create(
            {
              ...payload,
              link: `${slug(item.fields.name)}-cp-${item.guid.toLowerCase()}`,
              images: payload.images || [],
              description: item.fields.description,
              additionalFields: item.fields.additionalFields,
            },
            { transaction },
          );
          stats.created++;
        }
        byGuid.set(item.guid, product.id);
        for (const legacyId of item.legacyIds) byLegacy.delete(legacyId);
        for (const alias of candidates.filter(p => p.id !== product.id))
          await Product.update(
            { count: 0, sourceCount: 0, carpartsData: { mergedInto: product.id, guid: item.guid } },
            { where: { id: alias.id, isManual: false, carpartsGuid: null }, transaction },
          );
      });
    }
    if (!previous) {
      // First migration must also retire listings whose physical record has already
      // disappeared. Only a recorded Checkmate identity is sufficient evidence.
      const oldLinks = new Map();
      for (const link of source.legacyLinks)
        if (!guids.has(link.GUID)) {
          if (!oldLinks.has(String(link.ItemID))) oldLinks.set(String(link.ItemID), new Set());
          oldLinks.get(String(link.ItemID)).add(link.GUID);
        }
      const claimed = new Set(byGuid.keys());
      for (const old of products.filter(
        p => !p.isManual && !p.carpartsGuid && p.count > 0 && byLegacy.has(p.ebayLegacyId),
      )) {
        const choices = oldLinks.get(old.ebayLegacyId);
        if (choices?.size !== 1) continue;
        const guid = [...choices][0];
        await Product.update(
          {
            count: 0,
            sourceCount: 0,
            sourceMissing: true,
            ...(!claimed.has(guid) ? { source: 'carparts', carpartsGuid: guid } : {}),
            carpartsData: { reason: 'missing_at_cutover', guid },
          },
          { where: { id: old.id, isManual: false, carpartsGuid: null } },
        );
        claimed.add(guid);
        stats.missing++;
      }
    }
    // Only a fully validated and fully applied snapshot can retire missing parts.
    await sequelize.transaction(async transaction => {
      const missing = await Product.findAll({
        where: {
          source: 'carparts',
          sourceMissing: false,
          carpartsGuid: { [Op.notIn]: [...guids] },
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      for (const p of missing)
        await p.update({ count: 0, sourceCount: 0, sourceMissing: true }, { transaction });
      stats.missing += missing.length;
    });
    stats.finishedAt = new Date().toISOString();
    await CarpartsSyncState.upsert({ id: 'catalog', data: stats });
    return stats;
  });
}
async function publishReadyImages() {
  const products = await Product.findAll({
    where: { source: 'carparts', count: { [Op.gt]: 0 } },
    attributes: ['id', 'carpartsData', 'imagesHash', 'carpartsHash'],
    raw: true,
  });
  const urls = new Map(
    (
      await CarpartsImage.findAll({
        where: { url: { [Op.ne]: null } },
        attributes: ['id', 'url'],
        raw: true,
      })
    ).map(x => [x.id, x.url]),
  );
  const { hash } = require('./normalize');
  let published = 0;
  for (const p of products) {
    const photos = p.carpartsData?.photos || [];
    const fingerprint = hash(photos.map(x => x.id));
    if (p.imagesHash === fingerprint) continue;
    const images = photos.map(x => urls.get(x.id));
    if (!images.every(Boolean)) continue;
    // Optimistic guard: do not overwrite a newer photo manifest.
    const [n] = await Product.update(
      { images, imagesHash: fingerprint },
      { where: { id: p.id, carpartsHash: p.carpartsHash, source: 'carparts' } },
    );
    published += n;
  }
  return published;
}
module.exports = { syncCatalog, stageImages, publishReadyImages, reservedCount };
