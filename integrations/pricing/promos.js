const { Op } = require('sequelize');
const { sequelize } = require('../../db');
const { PromoCode, Order } = require('../../models/models');
const { amount } = require('./money');
function code(value) {
  if (typeof value !== 'string' || !value.trim()) throw Error('Enter a promo code');
  const s = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,40}$/.test(s)) throw Error('Invalid promo code');
  return s;
}
function fields(input) {
  const kind = input.kind;
  if (!['percent', 'fixed'].includes(kind)) throw Error('Choose percentage or fixed discount');
  const value = amount(input.value);
  if (kind === 'percent' && value >= 10000) throw Error('Discount must be less than 100%');
  const maxUses = input.maxUses == null || input.maxUses === '' ? null : Number(input.maxUses);
  if (maxUses != null && (!Number.isSafeInteger(maxUses) || maxUses < 1))
    throw Error('Invalid usage limit');
  const date = v => {
    if (v == null || v === '') return null;
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) throw Error('Invalid date');
    return d;
  };
  const startsAt = date(input.startsAt),
    endsAt = date(input.endsAt);
  if (startsAt && endsAt && startsAt >= endsAt) throw Error('End date must follow start date');
  if (typeof input.active !== 'boolean') throw Error('Invalid active flag');
  return {
    code: code(input.code),
    kind,
    value,
    minSubtotalCents: amount(input.minSubtotal || '0', { zero: true }),
    maxUses,
    startsAt,
    endsAt,
    active: input.active,
  };
}
async function usage(id, transaction) {
  return Order.count({
    where: {
      promoId: id,
      [Op.or]: [
        { stockAppliedAt: { [Op.ne]: null } },
        { stockReservedAt: { [Op.ne]: null }, stockReleasedAt: null },
      ],
    },
    transaction,
  });
}
async function list() {
  const rows = await PromoCode.findAll({ order: [['createdAt', 'DESC']], limit: 500 });
  return Promise.all(rows.map(async p => ({ ...p.get({ plain: true }), used: await usage(p.id) })));
}
async function save(id, input) {
  const data = fields(input);
  return sequelize.transaction(async transaction => {
    if (!id) return PromoCode.create(data, { transaction });
    const p = await PromoCode.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!p) throw Error('Promo code not found');
    return p.update(data, { transaction });
  });
}
// Allocate integer cents proportionally. Leave at least one cent per physical unit.
// This keeps Stripe, the captured order and Checkmate lines exactly consistent.
function allocate(lines, promo) {
  const subtotal = lines.reduce((s, x) => s + x.unitPriceCents * x.count, 0);
  if (!promo)
    return {
      discountCents: 0,
      subtotalCents: subtotal,
      lines: lines.map(x => ({ ...x, discountCents: 0 })),
    };
  if (subtotal < promo.minSubtotalCents)
    throw Error(
      `Promo code requires at least $${(promo.minSubtotalCents / 100).toFixed(2)} in products`,
    );
  const requested =
    promo.kind === 'percent' ? Math.round((subtotal * promo.value) / 10000) : promo.value;
  const capacities = lines.map(x => (x.unitPriceCents - 1) * x.count);
  const capacity = capacities.reduce((s, x) => s + x, 0);
  const discount = Math.min(requested, capacity);
  if (discount <= 0) throw Error('Promo code cannot be applied to this cart');
  const allocated = capacities.map(c => Math.floor((discount * c) / capacity));
  let remainder = discount - allocated.reduce((s, x) => s + x, 0);
  for (let i = 0; remainder > 0; i = (i + 1) % lines.length)
    if (allocated[i] < capacities[i]) {
      allocated[i]++;
      remainder--;
    }
  return {
    discountCents: discount,
    subtotalCents: subtotal - discount,
    lines: lines.map((x, i) => ({ ...x, discountCents: allocated[i] })),
  };
}
async function calculate(raw, lines, transaction) {
  if (raw == null || raw === '') return { ...allocate(lines, null), promo: null };
  const p = await PromoCode.findOne({
    where: { code: code(raw) },
    transaction,
    ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  const now = new Date();
  if (!p || !p.active || (p.startsAt && p.startsAt > now) || (p.endsAt && p.endsAt <= now))
    throw Error('Promo code is invalid or expired');
  if (p.maxUses != null && (await usage(p.id, transaction)) >= p.maxUses)
    throw Error('Promo code usage limit reached');
  return { ...allocate(lines, p), promo: p };
}
async function quote(input) {
  const { rows } = await require('../freight/service').loadBasket(input.products);
  const r = await calculate(input.promoCode, rows);
  return {
    code: r.promo?.code || null,
    discountCents: r.discountCents,
    subtotalCents: r.subtotalCents,
    originalSubtotalCents: rows.reduce((s, x) => s + x.unitPriceCents * x.count, 0),
  };
}
function stripeLines(product, item) {
  const total = item.unitPriceCents * item.count - (item.discountCents || 0),
    base = Math.floor(total / item.count),
    extra = total % item.count;
  return [
    [base, item.count - extra],
    [base + 1, extra],
  ]
    .filter(([, n]) => n > 0)
    .map(([price, n]) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: product.name,
          description: (product.about || product.name).slice(0, 500),
          tax_code: 'txcd_99999999',
        },
        unit_amount: price,
      },
      quantity: n,
    }));
}
module.exports = { code, fields, usage, list, save, calculate, allocate, quote, stripeLines };
