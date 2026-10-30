const {QueryTypes, Transaction} = require('sequelize');
const {sequelize} = require('../../db');

const CATEGORIES = ['Residential', 'Assurance', 'Dealership'];
const MAX_EXPORT = 10000;
const fail = message => { throw Object.assign(new Error(message), {status: 400}); };
function category(value) {
  if (value === null || value === '') return null;
  if (!CATEGORIES.includes(value)) fail('Choose Residential, Assurance or Dealership.');
  return value;
}
function integer(value, name, max = 2147483647) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > max) fail(`Invalid ${name}`);
  return Number(value);
}
// Aggregate orders and carts independently: joining both detail tables multiplies totals.
// Legacy paid orders predate paidAt. Their settled states remain included.
const DATA = `WITH purchases AS (
  SELECT "userId", COUNT(*)::int AS "paidOrdersCount",
    ROUND(SUM(sum)::numeric, 2)::float AS total,
    MAX(COALESCE("paidAt", "createdAt")) AS "lastOrderAt"
  FROM orders WHERE "isIntegrationTest" = false
    AND state IN ('confirmed', 'delivery', 'delivered', 'completed', 'paid')
  GROUP BY "userId"
), carts AS (
  SELECT c."userId", ROUND(SUM(c.count * p.price)::numeric, 2)::float AS "cartSum"
  FROM "cartProducts" c JOIN products p ON p.id = c."productId" GROUP BY c."userId"
), customers AS (
  SELECT u.id, u.name, u.mail, u.phone, u.category, u.discount, u."purchasingAs",
    u."resaleTaxExempt", u."createdAt", COALESCE(p.total, 0) AS total,
    COALESCE(p."paidOrdersCount", 0) AS "paidOrdersCount", p."lastOrderAt",
    COALESCE(c."cartSum", 0) AS "cartSum"
  FROM users u LEFT JOIN purchases p ON p."userId" = u.id LEFT JOIN carts c ON c."userId" = u.id
)`;
const SORTS = {
  name: 'LOWER(name)', mail: 'LOWER(mail)', createdAt: '"createdAt"',
  total: 'total', paidOrdersCount: '"paidOrdersCount"', lastOrderAt: '"lastOrderAt"',
  cartSum: '"cartSum"', purchasingAs: '"purchasingAs"', id: 'id',
};
function queryParts(input = {}, selection) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid filters');
  const where = [], bind = {};
  if (input.search !== undefined && input.search !== '') {
    if (typeof input.search !== 'string' || input.search.length > 200) fail('Search is too long');
    bind.search = `%${input.search.trim().replace(/[\\%_]/g, '\\$&')}%`;
    where.push('(name ILIKE $search OR mail ILIKE $search OR phone ILIKE $search OR id::text ILIKE $search)');
  }
  if (input.userId !== undefined && input.userId !== '') {
    bind.userId = integer(input.userId, 'user ID'); where.push('id = $userId');
  }
  if (input.purchasingAs) {
    if (input.purchasingAs === 'unset') where.push('"purchasingAs" IS NULL');
    else { bind.purchasingAs = category(input.purchasingAs); where.push('"purchasingAs" = $purchasingAs'); }
  }
  if (input.purchases) {
    if (!['yes','no'].includes(input.purchases)) fail('Invalid purchase filter');
    where.push(`"paidOrdersCount" ${input.purchases === 'yes' ? '>' : '='} 0`);
  }
  if (input.resale) {
    if (!['yes','no'].includes(input.resale)) fail('Invalid resale filter');
    bind.resale = input.resale === 'yes'; where.push('"resaleTaxExempt" = $resale');
  }
  const sort = input.sort || 'createdAt', direction = input.direction || 'desc';
  if (!Object.hasOwn(SORTS, sort) || !['asc','desc'].includes(direction)) fail('Invalid sort');
  if (selection !== undefined) {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection)) fail('Select users to export');
    const all = selection.allMatching === true;
    if (all && selection.ids !== undefined) fail('Choose one selection mode');
    const ids = all ? (selection.excludedIds || []) : selection.ids;
    if (!Array.isArray(ids) || ids.length > MAX_EXPORT || (!all && !ids.length)) fail('Select up to 10,000 users');
    bind.ids = [...new Set(ids.map(id => integer(id, 'selected user ID')))];
    if (all) where.push('NOT (id = ANY($ids::int[]))');
    else where.push('id = ANY($ids::int[])');
  }
  return {bind, where: where.length ? `WHERE ${where.join(' AND ')}` : '',
    order: `ORDER BY ${SORTS[sort]} ${direction.toUpperCase()} NULLS LAST, id ASC`};
}
async function list(input) {
  const page = integer(input.page || 1, 'page', 1000000), limit = integer(input.limit || 25, 'limit', 100);
  const {bind, where, order} = queryParts(input);
  return sequelize.transaction({isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ}, async transaction => {
    const [{count}] = await sequelize.query(`${DATA} SELECT COUNT(*)::int AS count FROM customers ${where}`, {bind, transaction, type: QueryTypes.SELECT});
    const rows = await sequelize.query(`${DATA} SELECT * FROM customers ${where} ${order} LIMIT $limit OFFSET $offset`, {
      bind: {...bind, limit, offset: (page - 1) * limit}, transaction, type: QueryTypes.SELECT});
    return {count, rows};
  });
}
async function exportRows(input, selection) {
  const {bind, where, order} = queryParts(input, selection);
  const rows = await sequelize.query(`${DATA} SELECT * FROM customers ${where} ${order} LIMIT ${MAX_EXPORT + 1}`, {bind, type: QueryTypes.SELECT});
  if (rows.length > MAX_EXPORT) fail('More than 10,000 users match. Narrow the filters before exporting.');
  return rows;
}
module.exports = {CATEGORIES, category, integer, queryParts, list, exportRows, fail};
