const {
  availability,
  validateSnapshot,
  normalizeSnapshot,
  hash,
} = require('../../integrations/carparts/normalize');
const guid = '11111111-1111-4111-8111-111111111111';
const row = {
  GUID: guid,
  InventoryID: '9032||HOS||1||1',
  Yard: 9032,
  Tag: '001',
  Part: 'HOS',
  Available: 'Yes',
  Private: 'No',
  Status: ' ',
  PriceRetail: 25,
  Description: 'Hose',
  TimeStamp: '1,100',
};
const snapshot = () => ({
  version: 1,
  complete: true,
  yard: '9032',
  beforeCount: 1,
  afterCount: 1,
  finishedAt: new Date().toISOString(),
  items: [{ ...row }],
  images: [],
  parts: [{ Part: 'HOS', FullName: 'HOSE' }],
  vehicles: [],
  legacyLinks: [],
});
test.each([
  ['S', 'status:S'],
  ['H', 'status:H'],
  ['D', 'status:D'],
  [' ', 'available'],
])('availability uses status %s, not just Available=Yes', (Status, expected) =>
  expect(availability({ ...row, Status })).toBe(expected),
);
test('private, zero-price and allocated stock cannot be purchased', () => {
  expect(availability({ ...row, Private: 'YES' })).toBe('private');
  expect(availability({ ...row, PriceRetail: 0 })).toBe('unpriced');
  expect(availability({ ...row, WONum: '123' })).toBe('allocated');
});
test('a partial snapshot cannot retire inventory', () => {
  for (const bad of [
    { complete: false },
    { afterCount: 2 },
    { items: [] },
    { items: [row, row], beforeCount: 2, afterCount: 2 },
  ])
    expect(() => validateSnapshot({ ...snapshot(), ...bad })).toThrow();
  expect(() => validateSnapshot(snapshot(), 100)).toThrow();
});
test('the same source is stable; photo changes affect the hash', () => {
  const s = snapshot();
  expect(normalizeSnapshot(s)[0].hash).toBe(normalizeSnapshot(s)[0].hash);
  s.images = [{ GUID: guid, ImageLocation: 'P:\\2026\\1\\a.jpg', ImageNumber: 1, CheckSum: 'a' }];
  expect(normalizeSnapshot(s)[0].hash).not.toBe(normalizeSnapshot(snapshot())[0].hash);
});
test('prices and catalog do not require an active eBay listing', () => {
  const p = normalizeSnapshot(snapshot())[0];
  expect(p.data.available).toBe(true);
  expect(p.fields.price).toBe(25);
  expect(p.legacyIds).toEqual([]);
});
test('hashes actual binary bytes', () =>
  expect(hash(Buffer.from('abc'))).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  ));
