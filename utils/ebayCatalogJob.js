const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { Op } = require('sequelize');
const { Product, OrderProduct } = require('../models/models');
const {
  fetchActiveInventoryReport,
  fetchItemDetail,
  fetchCompatibilityList,
  storeName,
  sellerId,
} = require('./ebayClient');
const { extractCpcmVehicleData } = require('./extractDescription');

const compatibilityEnabled = String(process.env.EBAY_COMPATIBILITY_ENABLED || 'true').toLowerCase() === 'true';
const markMissingAsSold = String(process.env.EBAY_MARK_MISSING_AS_SOLD || 'false').toLowerCase() === 'true';

let sampleDetailSaved = false;
let ebaySyncRunning = false;

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

/**
 * Extract make (BMW, Audi, Mercedes-Benz) from eBay brand field
 * Brand examples: "BAVARIAN MOTOR WORKS (BMW)", "AUDI", "MERCEDES-BENZ"
 */
const extractMake = (brand) => {
  if (!brand) return 'BMW'; // Default to BMW

  const brandUpper = brand.toUpperCase();

  // Check for BMW variations
  if (brandUpper.includes('BMW') || brandUpper.includes('BAVARIAN')) {
    return 'BMW';
  }

  // Check for Audi
  if (brandUpper.includes('AUDI')) {
    return 'Audi';
  }

  // Check for Mercedes-Benz variations
  if (brandUpper.includes('MERCEDES') || brandUpper.includes('BENZ')) {
    return 'Mercedes-Benz';
  }

  // Return original brand if not matched
  return brand;
};

// Restore visible stock for items that came from eBay but are zero in DB while never being ordered.
const restoreCountIfNoOrders = async (existing, payload) => {
  if (!existing) return;

  const incomingCount = payload.count ?? 0;
  const existingCount = existing.count ?? 0;

  if (incomingCount !== 0) return;
  if (existingCount > 1) return;

  const ordersCount = await OrderProduct.count({ where: { productId: existing.id } });
  if (ordersCount === 0) {
    payload.count = 1;
    console.log(
      `[eBay] Restored count to 1 for product ${existing.id} (eBay item ${existing.ebayItemId || 'unknown'}) - no orders found.`
    );
  }
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

  // Extract make from brand field
  const make = detail.brand;

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
    make,
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

const syncProductFromDetail = async (detail, overrides = {}) => {
  const ebayItemId = detail.itemId;
  if (!ebayItemId) return;

  const payload = buildProductPayload(detail);
  if (overrides.stock !== undefined && overrides.stock !== null) {
    payload.count = overrides.stock;
    payload.ebayStock = overrides.stock;
  }
  if (overrides.price !== undefined && overrides.price !== null && overrides.price > 0) {
    payload.price = overrides.price;
    payload.old_price = overrides.price;
  }
  if (overrides.legacyItemId && !payload.ebayLegacyId) {
    payload.ebayLegacyId = overrides.legacyItemId;
  }

  const existing = await findExistingProduct(ebayItemId, payload.ebayLegacyId);

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

  // await saveSamples(detail);
};

const findExistingProduct = async (ebayItemId, legacyItemId) => {
  const or = [];
  if (ebayItemId) {
    or.push({ ebayItemId });
  }
  if (legacyItemId) {
    or.push({ ebayLegacyId: legacyItemId });
  }

  if (!or.length) {
    return null;
  }

  return Product.findOne({ where: { [Op.or]: or } });
};

const maybeSyncItem = async (summary) => {
  const ebayItemId = summary.itemId;
  if (!ebayItemId) return;

  const summaryStock = getStockFromAny(summary);
  const existing = await findExistingProduct(ebayItemId, summary.legacyItemId);

  if (existing && existing.isManual) {
    return;
  }

  if (existing) {
    const nextStock = summaryStock ?? existing.count ?? 0;
    const updates = {
      ebayItemId,
      ebayLegacyId: summary.legacyItemId || existing.ebayLegacyId,
      ebayStock: nextStock,
      count: nextStock,
    };

    if (summary.price !== undefined && summary.price !== null && summary.price > 0) {
      updates.price = summary.price;
      updates.old_price = summary.price;
    }

    const changed = Object.entries(updates).some(([key, value]) => existing[key] !== value);

    if (changed) {
      await existing.update(updates);
    }

    return;
  }

  try {
    const detail = await fetchItemDetail(ebayItemId);
    await syncProductFromDetail(detail, {
      stock: summaryStock,
      price: summary.price,
      legacyItemId: summary.legacyItemId,
    });
  } catch (err) {
    const details = err?.response?.data || err?.message || err;
    console.error(`[eBay] Failed to sync item ${ebayItemId}:`, details);
  }
};

/**
 * Mark eBay products as sold (count = 0) if they are missing from current sync
 * This happens when products are sold on eBay and no longer appear in the catalog
 */
const markMissingProductsAsSold = async (syncedItems) => {
  try {
    const syncedEbayItemIds = new Set(syncedItems.map((item) => item.itemId).filter(Boolean));
    const syncedLegacyItemIds = new Set(syncedItems.map((item) => item.legacyItemId).filter(Boolean));

    // Find all eBay products in DB (isManual = false, count > 0)
    const allEbayProducts = await Product.findAll({
      where: {
        isManual: false,
        count: { [Op.gt]: 0 }
      },
      attributes: ['id', 'ebayItemId', 'ebayLegacyId', 'name', 'count']
    });

    let markedCount = 0;
    const minimumSyncedItems = Number(process.env.EBAY_MIN_SYNCED_ITEMS_FOR_MARK_MISSING || 1000);
    const minimumRatio = Number(process.env.EBAY_MIN_SYNC_RATIO_FOR_MARK_MISSING || 0.5);

    if (syncedItems.length < minimumSyncedItems) {
      console.log(
        `[eBay] Skipping mark-missing: only ${syncedItems.length} synced items, minimum is ${minimumSyncedItems}.`
      );
      return;
    }

    if (syncedItems.length < allEbayProducts.length * minimumRatio) {
      console.log(
        `[eBay] Skipping mark-missing: ${syncedItems.length} synced items is below ${minimumRatio} of ${allEbayProducts.length} active DB items.`
      );
      return;
    }

    // Check each eBay product in DB
    for (const product of allEbayProducts) {
      if (!product.ebayItemId && !product.ebayLegacyId) {
        console.log(`[eBay] Product ${product.id} has isManual=false but no eBay id, skipping.`);
        continue;
      }

      // If product's ebayItemId is NOT in the synced list, it was sold on eBay
      const existsInSync =
        (product.ebayItemId && syncedEbayItemIds.has(product.ebayItemId)) ||
        (product.ebayLegacyId && syncedLegacyItemIds.has(product.ebayLegacyId));

      if (!existsInSync) {
        await product.update({ count: 0, ebayStock: 0 });
        console.log(`[eBay] Product ${product.id} (${product.name}) - eBay item ${product.ebayItemId} not found in sync, set count to 0 (sold on eBay)`);
        markedCount++;
      }
    }

    if (markedCount > 0) {
      console.log(`[eBay] Marked ${markedCount} products as sold (count = 0) - they were sold on eBay.`);
    } else {
      console.log(`[eBay] No products needed to be marked as sold.`);
    }
  } catch (error) {
    console.error('[eBay] Error marking missing products as sold:', error);
  }
};

const runEbayCatalogPull = async () => {
  if (ebaySyncRunning) {
    console.log('[eBay] Sync already running, skipping this pass.');
    return;
  }

  ebaySyncRunning = true;

  try {
    console.log(
      `[eBay] Fetching active inventory report for store "${storeName}" (seller ${sellerId})...`
    );

    const reportItems = await fetchActiveInventoryReport();
    const dedupMap = new Map();
    reportItems.forEach((item) => dedupMap.set(item.itemId, item));

    const uniqueItems = Array.from(dedupMap.values());
    console.log(`[eBay] Total unique active inventory items collected: ${uniqueItems.length}.`);

    for (let i = 0; i < uniqueItems.length; i++) {
      await maybeSyncItem(uniqueItems[i]);
      if ((i + 1) % 250 === 0 || i + 1 === uniqueItems.length) {
        console.log(`[eBay] Synced ${i + 1}/${uniqueItems.length} active inventory items.`);
      }
    }

    if (markMissingAsSold) {
      await markMissingProductsAsSold(uniqueItems);
    } else {
      console.log('[eBay] Skipping markMissingProductsAsSold; EBAY_MARK_MISSING_AS_SOLD is not true.');
    }

    console.log('[eBay] Sync pass completed.');
  } finally {
    ebaySyncRunning = false;
  }
};

const scheduleEbayCatalogJob = () => {
  runEbayCatalogPull().catch((err) => {
    const details = err?.response?.data || err?.message || err;
    console.error('[eBay] Initial fetch failed:', details);
  });

  // Run every 2 hours
  cron.schedule('0 */8 * * *', async () => {
    try {
      await runEbayCatalogPull();
    } catch (err) {
      const details = err?.response?.data || err?.message || err;
      console.error('[eBay] Scheduled fetch failed:', details);
    }
  });
};

module.exports = { scheduleEbayCatalogJob };
