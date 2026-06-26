const AdmZip = require('adm-zip');
const axios = require('axios');

const EBAY_AUTH_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_BROWSE_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const EBAY_USER_SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
];

const storeName = process.env.EBAY_STORE_NAME || 'carismamotorsparts';
const sellerId = process.env.EBAY_SELLER_ID || storeName;
const defaultLimit = Number(process.env.EBAY_CATALOG_LIMIT || 50);
const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
const defaultQuery = process.env.EBAY_QUERY || 'a';
const shoppingApiUrl = 'https://open.api.ebay.com/shopping';
const feedApiUrl = 'https://api.ebay.com/sell/feed/v1';

let cachedToken = null;
let cachedUserToken = null;

const getBasicAuthHeader = () => {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET');
  }

  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
};

const getAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.token;
  }

  const body = `grant_type=client_credentials&scope=${encodeURIComponent(EBAY_SCOPE)}`;

  const { data } = await axios.post(EBAY_AUTH_URL, body, {
    headers: {
      Authorization: getBasicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 0) * 1000,
  };

  return cachedToken.token;
};

const getUserAccessToken = async () => {
  const refreshToken = process.env.EBAY_REFRESH_TOKEN || process.env.EBAY_USER_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error('Missing EBAY_REFRESH_TOKEN for seller APIs');
  }

  const now = Date.now();
  if (cachedUserToken && cachedUserToken.expiresAt - 60_000 > now) {
    return cachedUserToken.token;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: EBAY_USER_SCOPES.join(' '),
  }).toString();

  const { data } = await axios.post(EBAY_AUTH_URL, body, {
    headers: {
      Authorization: getBasicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  cachedUserToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 0) * 1000,
  };

  return cachedUserToken.token;
};

const fetchStoreCatalog = async ({ limit = defaultLimit, offset = 0, query = defaultQuery } = {}) => {
  const token = await getAccessToken();

  // eBay API требует обязательный параметр q
  // Используем минимальный query (один символ) + фильтр по seller
  // Это получит все товары продавца, содержащие хотя бы один символ в названии
  const effectiveQuery = (query && query.trim() !== '') ? query : 'a';

  const params = {
    q: effectiveQuery,
    limit,
    offset,
    filter: `sellers:{${sellerId}}`,
  };

  const response = await axios.get(EBAY_BROWSE_URL, {
    params,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
    },
  });

  const { itemSummaries = [], total } = response.data || {};

  return {
    items: itemSummaries,
    total: typeof total === 'number' ? total : itemSummaries.length,
  };
};

const fetchItemDetail = async (itemId) => {
  if (!itemId) throw new Error('Missing itemId for item detail fetch');

  const token = await getAccessToken();
  const url = `https://api.ebay.com/buy/browse/v1/item/${itemId}`;

  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
    },
  });

  return data;
};

const createActiveInventoryTask = async () => {
  const token = await getUserAccessToken();

  const response = await axios.post(
    `${feedApiUrl}/inventory_task`,
    {
      feedType: 'LMS_ACTIVE_INVENTORY_REPORT',
      schemaVersion: '1.0',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      },
      validateStatus: (status) => status >= 200 && status < 300,
    }
  );

  const taskUrl = response.headers.location;
  const taskId = taskUrl && taskUrl.split('/').pop();

  if (!taskId) {
    throw new Error('eBay Feed API did not return an inventory task id');
  }

  return taskId;
};

const getInventoryTask = async (taskId) => {
  const token = await getUserAccessToken();
  const { data } = await axios.get(`${feedApiUrl}/inventory_task/${taskId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  return data;
};

const waitForInventoryTask = async (taskId) => {
  const timeoutMs = Number(process.env.EBAY_FEED_TASK_TIMEOUT_MS || 300_000);
  const pollMs = Number(process.env.EBAY_FEED_TASK_POLL_MS || 10_000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const task = await getInventoryTask(taskId);
    const status = task.status;

    console.log(`[eBay] Active inventory task ${taskId} status: ${status}`);

    if (status === 'COMPLETED') {
      return task;
    }

    if (['ABORTED', 'COMPLETED_WITH_ERROR', 'FAILED'].includes(status)) {
      throw new Error(`eBay active inventory task ${taskId} finished with status ${status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Timed out waiting for eBay active inventory task ${taskId}`);
};

const downloadInventoryTaskResult = async (taskId) => {
  const token = await getUserAccessToken();
  const response = await axios.get(`${feedApiUrl}/task/${taskId}/download_result_file`, {
    responseType: 'arraybuffer',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: '*/*',
    },
  });

  return Buffer.from(response.data);
};

const xmlValue = (text, tagName) => {
  const match = text.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  if (!match) return null;

  return match[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

const parseActiveInventoryReport = (archiveBuffer) => {
  const zip = new AdmZip(archiveBuffer);
  const xmlEntry = zip.getEntries().find((entry) => entry.entryName.endsWith('.xml'));

  if (!xmlEntry) {
    throw new Error('eBay active inventory report did not contain an XML file');
  }

  const xml = xmlEntry.getData().toString('utf8');
  const rows = [];
  const skuDetailsMatches = xml.matchAll(/<SKUDetails>([\s\S]*?)<\/SKUDetails>/g);

  for (const match of skuDetailsMatches) {
    const block = match[1];
    const legacyItemId = xmlValue(block, 'ItemID');
    const quantity = Number(xmlValue(block, 'Quantity') || 0);
    const price = Number(xmlValue(block, 'Price') || 0);
    const sku = xmlValue(block, 'SKU');

    if (!legacyItemId) {
      continue;
    }

    rows.push({
      sku,
      legacyItemId,
      itemId: `v1|${legacyItemId}|0`,
      estimatedAvailableQuantity: Number.isNaN(quantity) ? 0 : quantity,
      price: Number.isNaN(price) ? null : price,
    });
  }

  return rows;
};

const fetchActiveInventoryReport = async () => {
  const taskId = await createActiveInventoryTask();
  console.log(`[eBay] Created active inventory task ${taskId}.`);
  await waitForInventoryTask(taskId);

  const archive = await downloadInventoryTaskResult(taskId);
  const items = parseActiveInventoryReport(archive);
  console.log(`[eBay] Active inventory report returned ${items.length} rows.`);

  return items;
};

const fetchCompatibilityList = async (legacyItemId) => {
  if (!legacyItemId) throw new Error('Missing legacyItemId for compatibility fetch');
  const token = await getAccessToken();

  const { data } = await axios.get(shoppingApiUrl, {
    params: {
      callname: 'GetSingleItem',
      responseencoding: 'JSON',
      appid: process.env.EBAY_CLIENT_ID,
      siteid: 0,
      version: 967,
      ItemID: legacyItemId,
      IncludeSelector: 'Compatibility',
    },
    headers: {
      'X-EBAY-API-IAF-TOKEN': token,
    },
  });

  if (data?.Ack && data.Ack !== 'Success') {
    const errMsg = data?.Errors?.[0]?.LongMessage || data?.Errors?.[0]?.ShortMessage || data.Ack;
    throw new Error(`Shopping API error: ${errMsg}`);
  }

  const compatList = data?.Item?.ItemCompatibilityList?.Compatibility || [];
  return compatList.map((entry) => {
    const row = {};
    (entry?.NameValueList || []).forEach(({ Name, Value }) => {
      if (!Name) return;
      row[Name.toLowerCase()] = Value;
    });
    if (entry?.CompatibilityNotes) {
      row.notes = entry.CompatibilityNotes;
    }
    return row;
  });
};

module.exports = {
  fetchStoreCatalog,
  fetchActiveInventoryReport,
  fetchItemDetail,
  fetchCompatibilityList,
  getAccessToken,
  getUserAccessToken,
  storeName,
  sellerId,
};
