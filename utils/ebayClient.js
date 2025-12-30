const axios = require('axios');

const EBAY_AUTH_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const EBAY_BROWSE_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const EBAY_SCOPE = 'https://api.ebay.com/oauth/api_scope';

const storeName = process.env.EBAY_STORE_NAME || 'carismamotorsparts';
const sellerId = process.env.EBAY_SELLER_ID || storeName;
const defaultLimit = Number(process.env.EBAY_CATALOG_LIMIT || 50);
const marketplaceId = process.env.EBAY_MARKETPLACE_ID || 'EBAY_US';
const defaultQuery = process.env.EBAY_QUERY || 'a';
const shoppingApiUrl = 'https://open.api.ebay.com/shopping';

let cachedToken = null;

const getAccessToken = async () => {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET');
  }

  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.token;
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = `grant_type=client_credentials&scope=${encodeURIComponent(EBAY_SCOPE)}`;

  const { data } = await axios.post(EBAY_AUTH_URL, body, {
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 0) * 1000,
  };

  return cachedToken.token;
};

const fetchStoreCatalog = async ({ limit = defaultLimit, offset = 0, query = defaultQuery } = {}) => {
  const token = await getAccessToken();

  const response = await axios.get(EBAY_BROWSE_URL, {
    params: {
      q: query,
      limit,
      offset,
      filter: `sellers:{${sellerId}}`,
    },
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
  fetchItemDetail,
  fetchCompatibilityList,
  getAccessToken,
  storeName,
  sellerId,
};
