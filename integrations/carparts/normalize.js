const crypto = require('crypto');
const text = v => String(v ?? '').trim();
const hash = v =>
  crypto
    .createHash('sha256')
    .update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v))
    .digest('hex');
const GUID = /^[0-9A-F]{8}-(?:[0-9A-F]{4}-){3}[0-9A-F]{12}$/;
function availability(row) {
  if (text(row.Part) === 'AUT') return 'vehicle';
  if (text(row.Private).toLowerCase() === 'yes') return 'private';
  if (text(row.Available).toLowerCase() !== 'yes') return 'unavailable';
  if (text(row.Status)) return `status:${text(row.Status)}`;
  // Checkmate C means sold on eBay, awaiting an invoice; Available can still be Yes.
  if ([row.EbayStatus, row.DisplayStatus].some(v => text(v).toUpperCase() === 'C'))
    return 'committed';
  if (text(row.WONum) || text(row.HoldName)) return 'allocated';
  if (!(Number(row.PriceRetail) > 0)) return 'unpriced';
  return 'available';
}
function validateSnapshot(snapshot, previousCount = 0) {
  if (
    snapshot?.version !== 1 ||
    snapshot.complete !== true ||
    snapshot.yard !== '9032' ||
    !Array.isArray(snapshot.items) ||
    !Array.isArray(snapshot.images)
  )
    throw Error('Incomplete or wrong-yard Checkmate snapshot');
  if (snapshot.beforeCount !== snapshot.afterCount || snapshot.items.length !== snapshot.afterCount)
    throw Error('Checkmate snapshot count changed or query returned incomplete rows');
  if (
    snapshot.items.length < 1 ||
    (previousCount > 0 && snapshot.items.length < previousCount * 0.8)
  )
    throw Error('Unexpected inventory drop; reconciliation stopped for review');
  const ids = new Set();
  for (const r of snapshot.items) {
    if (
      !GUID.test(text(r.GUID)) ||
      String(r.Yard) !== '9032' ||
      ids.has(r.GUID) ||
      !text(r.InventoryID)
    )
      throw Error('Invalid/duplicate inventory identity');
    ids.add(r.GUID);
  }
  if (!snapshot.finishedAt || !Number.isFinite(Date.parse(snapshot.finishedAt)))
    throw Error('Invalid snapshot time');
  return ids;
}
function normalize(row, { parts, vehicles, images, links }) {
  const vehicle = vehicles.get(row.AutGUID) || {};
  const makes = {
    'BAVARIAN MOTOR WORKS (BMW)': 'BMW',
    AUDI: 'Audi',
    'MERCEDES-BENZ': 'Mercedes-Benz',
  };
  let aspects = [];
  try {
    const obj =
      typeof row.ItemSpecifics === 'string' ? JSON.parse(row.ItemSpecifics) : row.ItemSpecifics;
    aspects = (obj?.itemspecifics || []).map(x => ({
      name: x.itemspecific,
      values: (x.values || []).map(y => text(y.value)).filter(Boolean),
    }));
  } catch {}
  const title =
    aspects.find(x => x.name === 'eBay Title')?.values?.[0] ||
    text(row.Description) ||
    `${text(row.Part)} ${text(row.Tag)}`;
  const photos = (images.get(row.GUID) || [])
    .sort(
      (a, b) =>
        Number(Number(b.PrimaryImage) === Number(b.ImageNumber)) -
          Number(Number(a.PrimaryImage) === Number(a.ImageNumber)) ||
        Number(a.ImageNumber) - Number(b.ImageNumber) ||
        a.ImageLocation.localeCompare(b.ImageLocation),
    )
    .map(x => ({
      ...x,
      id: hash([x.GUID, x.ImageLocation, x.ImageNumber, x.CheckSum, x.WebCheckSum]),
    }));
  const reason = availability(row);
  const data = {
    inventoryId: text(row.InventoryID),
    tag: text(row.Tag),
    stock: text(row.Stock),
    timestamp: text(row.TimeStamp),
    status: text(row.Status),
    available: reason === 'available',
    reason,
    photos,
    part: text(row.Part),
    aspects,
  };
  const fields = {
    name: title,
    description: text(row.Description),
    price: Number(row.PriceRetail) || 0,
    old_price: Number(row.PriceRetail) || 0,
    make: text(row.Manufacturer),
    ebayModel: text(vehicle.ModelLong) || text(row.Model),
    ebayYear: text(row.Yr),
    ebayVin: text(row.VIN),
    ebayVehicleInfo: [row.Yr, vehicle.ModelLong || row.Model].map(text).filter(Boolean).join(' '),
    ebayCategory: parts.get(row.Part) || text(row.Part),
    about: text(row.Description),
    ebayAdditionalNotes: text(row.Description),
    additionalFields: {
      localizedAspects: [
        ...aspects
          .filter(x => x.name !== 'eBay Title')
          .map(x => ({ name: x.name, value: x.values.join(', ') })),
        { name: 'Stock number', value: text(row.Tag) },
        { name: 'Mileage', value: text(vehicle.Mileage || row.Condition) },
        { name: 'Grade', value: text(row.PartGrade) },
        { name: 'Side', value: text(row.Side) },
        { name: 'Interchange', value: text(row.Interchange) },
      ].filter(x => x.value),
    },
  };
  const legacyIds = [
    ...new Set([...(links.get(row.GUID) || []), text(row.EbayOriginalListingID)].filter(Boolean)),
  ];
  fields.make = makes[fields.make] || fields.make;
  return {
    guid: row.GUID,
    data,
    fields,
    legacyIds,
    hash: hash({ data, fields }),
    imagesHash: hash(photos.map(x => x.id)),
  };
}
function normalizeSnapshot(snapshot) {
  const parts = new Map(snapshot.parts.map(x => [x.Part, text(x.FullName)]));
  const vehicles = new Map(snapshot.vehicles.map(x => [x.GUID, x]));
  const images = new Map();
  const links = new Map();
  for (const x of snapshot.images) {
    if (!images.has(x.GUID)) images.set(x.GUID, []);
    images.get(x.GUID).push(x);
  }
  for (const x of snapshot.legacyLinks) {
    if (!links.has(x.GUID)) links.set(x.GUID, []);
    links.get(x.GUID).push(text(x.ItemID));
  }
  return snapshot.items.map(row => normalize(row, { parts, vehicles, images, links }));
}
module.exports = { text, hash, GUID, availability, validateSnapshot, normalizeSnapshot };
