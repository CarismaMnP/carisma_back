const fs = require('fs');
const path = require('path');
const { Product } = require('../models/models');
const { fetchStoreCatalog, fetchItemDetail, fetchCompatibilityList, storeName, sellerId } = require('./ebayClient');
const { extractCpcmVehicleData } = require('./extractDescription');

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const pageSize = Number(process.env.EBAY_CATALOG_LIMIT || 50);
const querySeeds = (process.env.EBAY_QUERY_SEEDS || 'a,e,i,o,u,0,1,2,3,4,5,6,7,8,9')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const compatibilityEnabled = String(process.env.EBAY_COMPATIBILITY_ENABLED || 'true').toLowerCase() === 'true';

let sampleDetailSaved = false;

const slugify = (text) => {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
};

const getStockFromAny = (data) => {
  const fromAvail = data?.estimatedAvailabilities?.[0]?.estimatedAvailableQuantity;
  if (fromAvail !== undefined) return Number(fromAvail);
  if (data?.estimatedAvailableQuantity !== undefined) return Number(data.estimatedAvailableQuantity);
  const localized = (data.localizedAspects || []).find(
    (a) => (a.name || '').toLowerCase() === 'stock' || (a.localizedName || '').toLowerCase() === 'stock'
  );
  if (localized && localized.value !== undefined) {
    const num = Number(localized.value);
    if (!Number.isNaN(num)) return num;
  }
  return null;
};

const buildProductPayload = (detail) => {
  const descData = extractCpcmVehicleData(detail.description || '');
  const priceValue = Number(detail?.price?.value) || 0;
  const mainImage = detail?.image?.imageUrl;
  const additional = (detail?.additionalImages || []).map((img) => img.imageUrl).filter(Boolean);
  const images = [mainImage, ...additional].filter(Boolean);
  const stock = getStockFromAny(detail);
  const stockValue = stock === null ? 0 : stock;
  const legacyId = detail.legacyItemId || (detail.itemId && detail.itemId.split('|')[1]) || null;
  const link = `${slugify(detail.title || 'ebay-item')}-${legacyId || detail.itemId || 'unknown'}`;
  const categoryPathArray = (detail.categoryPath || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  const categoryLeaf = categoryPathArray.slice(-1)[0] || null;

  return {
    name: detail.title || 'eBay item',
    description: detail.description || detail.shortDescription || '',
    link,
    images,
    price: priceValue,
    old_price: priceValue,
    categoryId: null,
    count: stockValue,
    about: descData.additionalNotes || '',
    additionalFields: { localizedAspects: detail.localizedAspects || [] },
    selector: '',

    ebayItemId: detail.itemId || null,
    ebayLegacyId: legacyId,
    ebayStock: stock,
    ebayVin: descData.vin || null,
    ebayVehicleInfo: descData.vehicleInfo || null,
    ebayAlsoFits: descData.alsoFits || [],
    ebayAlsoFitsRaw: descData.alsoFitsRaw || '',
    ebayYear: descData.year || null,
    ebayModel: descData.model || null,
    ebayAdditionalNotes: descData.additionalNotes || '',
    ebayCategoryId: detail.categoryId || null,
    ebayCategoryPath: categoryPathArray.length ? categoryPathArray : null,
    ebayCategory: categoryLeaf,
    isManual: false,
  };
};

const saveSamples = async (detail) => {
  if (sampleDetailSaved || !detail) return;
  sampleDetailSaved = true;

  const detailPath = path.join(__dirname, '../ebay_detail_sample.txt');
  fs.writeFileSync(detailPath, JSON.stringify(detail, null, 2), 'utf8');
  console.log(`[eBay] Saved full detail for ${detail.itemId || 'unknown'} to ${detailPath}`);

  const legacyId = detail.legacyItemId || (detail.itemId && detail.itemId.split('|')[1]);
  if (compatibilityEnabled && legacyId) {
    try {
      const compatibility = await fetchCompatibilityList(legacyId);
      const compatPath = path.join(__dirname, '../ebay_compatibility_sample.json');
      fs.writeFileSync(
        compatPath,
        JSON.stringify({ legacyItemId: legacyId, compatibility }, null, 2),
        'utf8'
      );
      console.log(
        `[eBay] Saved compatibility (${compatibility.length} rows) for legacy ${legacyId} to ${compatPath}`
      );
    } catch (err) {
      const details = err?.response?.data || err?.message || err;
      console.error(`[eBay] Failed to fetch compatibility for ${legacyId}:`, details);
    }
  }
};

const syncProductFromDetail = async (detail) => {
  const ebayItemId = detail.itemId;
  if (!ebayItemId) return;

  const payload = buildProductPayload(detail);
  const existing = await Product.findOne({ where: { ebayItemId } });

  if (existing && existing.isManual) {
    console.log(`[eBay] Skip manual product for ${ebayItemId}, leaving untouched.`);
    return;
  }

  if (existing) {
    await existing.update(payload);
    console.log(`[eBay] Updated product for ${ebayItemId} (stock: ${payload.count}).`);
  } else {
    await Product.create(payload);
    console.log(`[eBay] Created product for ${ebayItemId} (stock: ${payload.count}).`);
  }

  await saveSamples(detail);
};

const maybeSyncItem = async (summary) => {
  const ebayItemId = summary.itemId;
  if (!ebayItemId) return;

  const summaryStock = getStockFromAny(summary);
  const existing = await Product.findOne({ where: { ebayItemId } });

  if (existing && existing.isManual) {
    return;
  }

  let needDetail = !existing;
  if (!needDetail && summaryStock === null) {
    // Если в summary нет стока, но в БД уже есть товар, оставляем как есть
    // (будем обновлять только когда приходит сток в summary или товара еще нет)
    if (existing.ebayStock == null && existing.count == null) {
      needDetail = true;
    } else {
      needDetail = false;
    }
  }
  if (!needDetail && summaryStock !== null) {
    const currentStock = existing.ebayStock ?? existing.count ?? 0;
    if (summaryStock !== currentStock) {
      needDetail = true;
    }
  }

  if (!needDetail && existing) {
    return;
  }

  try {
    const detail = await fetchItemDetail(ebayItemId);
    await syncProductFromDetail(detail);
  } catch (err) {
    const details = err?.response?.data || err?.message || err;
    console.error(`[eBay] Failed to sync item ${ebayItemId}:`, details);
  }
};

const fetchAllForQuery = async (query) => {
  let offset = 0;
  const collected = [];
  const limit = pageSize;

  while (true) {
    const { items } = await fetchStoreCatalog({ limit, offset, query });

    if (!items.length) {
      break;
    }

    collected.push(...items);
    if (items.length < limit) {
      break;
    }

    offset += limit;
  }

  return collected;
};

const runEbayCatalogPull = async () => {
  console.log(
    `[eBay] Fetching catalog for store "${storeName}" (seller ${sellerId}) using seeds [${querySeeds.join(', ')}]...`
  );
  const dedupMap = new Map();

  for (const seed of querySeeds) {
    const items = await fetchAllForQuery(seed);
    console.log(`[eBay] Seed "${seed}" returned ${items.length} items.`);
    items.forEach((item) => dedupMap.set(item.itemId, item));
  }

  const uniqueItems = Array.from(dedupMap.values());
  console.log(`[eBay] Total unique items collected: ${uniqueItems.length}.`);

  for (const item of uniqueItems) {
    await maybeSyncItem(item);
  }

  console.log('[eBay] Sync pass completed.');
};

const scheduleEbayCatalogJob = () => {
  runEbayCatalogPull().catch((err) => {
    const details = err?.response?.data || err?.message || err;
    console.error('[eBay] Initial fetch failed:', details);
  });

  setInterval(async () => {
    try {
      await runEbayCatalogPull();
    } catch (err) {
      const details = err?.response?.data || err?.message || err;
      console.error('[eBay] Scheduled fetch failed:', details);
    }
  }, THIRTY_MINUTES_MS);
};

module.exports = { scheduleEbayCatalogJob };
