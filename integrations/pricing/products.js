const { Op } = require('sequelize');
const { sequelize } = require('../../db');
const { Product, PriceChangeBatch } = require('../../models/models');
const { filters } = require('../../utils/adminProductFilters');
const { operation, changePrice } = require('./money');
const ids = value => {
  if (
    !Array.isArray(value) ||
    value.length > 20000 ||
    value.some(x => !Number.isSafeInteger(x) || x < 1)
  )
    throw Error('Invalid product selection');
  return [...new Set(value)];
};
const summary = b => ({
  id: b.id,
  count: b.rows.length,
  state: b.state,
  expiresAt: b.expiresAt,
  operation: b.operation,
  sample: b.rows.slice(0, 10),
  beforeCents: b.rows.reduce((s, x) => s + x.before, 0),
  afterCents: b.rows.reduce((s, x) => s + x.after, 0),
});
async function preview(userId, input) {
  const selection = input.selection;
  let where;
  if (selection?.mode === 'ids') {
    const selected = ids(selection.ids);
    if (!selected.length) throw Error('Select at least one product');
    where = { id: { [Op.in]: selected } };
  } else if (selection?.mode === 'filter') {
    const excluded = ids(selection.excludedIds || []);
    where = {
      [Op.and]: [filters(selection.filters || {}).where, { id: { [Op.notIn]: excluded } }],
    };
  } else throw Error('Select products before changing prices');
  const op = operation(input.operation);
  const products = await Product.findAll({ where, order: [['id', 'ASC']], limit: 20001 });
  if (!products.length || products.length > 20000)
    throw Error('Select between 1 and 20,000 products');
  if (selection.mode === 'ids' && products.length !== ids(selection.ids).length)
    throw Error('A selected product no longer exists');
  const rows = products.map(p => changePrice(p, op));
  return summary(
    await PriceChangeBatch.create({
      userId,
      operation: op,
      rows,
      expiresAt: new Date(Date.now() + 10 * 60000),
    }),
  );
}
async function apply(userId, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw Error('Invalid price preview');
  return sequelize.transaction(async transaction => {
    const b = await PriceChangeBatch.findOne({
      where: { id, userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!b) throw Error('Price preview not found');
    if (b.state === 'applied') return summary(b);
    if (b.expiresAt <= new Date()) throw Error('Price preview expired; calculate it again');
    const products = await Product.findAll({
      where: { id: { [Op.in]: b.rows.map(x => x.id) } },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const map = new Map(products.map(p => [p.id, p]));
    for (const r of b.rows) {
      const p = map.get(r.id);
      if (
        !p ||
        Math.round(p.price * 100) !== r.before ||
        p.source !== r.source ||
        p.priceOverrideCents !== r.overrideBefore ||
        (b.operation.kind === 'reset' && p.carpartsPriceCents !== r.sourcePrice)
      )
        throw Error('A selected price changed. Nothing was saved; calculate a fresh preview.');
    }
    for (const r of b.rows)
      await map
        .get(r.id)
        .update(
          { price: r.after / 100, old_price: r.after / 100, priceOverrideCents: r.overrideAfter },
          { transaction },
        );
    await b.update({ state: 'applied', appliedAt: new Date() }, { transaction });
    return summary(b);
  });
}
module.exports = { preview, apply };
