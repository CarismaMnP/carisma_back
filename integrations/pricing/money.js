const MAX_CENTS = 99999999;
function amount(value, { zero = false } = {}) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(String(value)))
    throw Error('Enter an amount with up to two decimal places');
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents < (zero ? 0 : 1) || cents > MAX_CENTS)
    throw Error('Amount is out of range');
  return cents;
}
function operation(input) {
  const kind = input?.kind;
  if (
    ![
      'set',
      'increase_amount',
      'decrease_amount',
      'increase_percent',
      'decrease_percent',
      'reset',
    ].includes(kind)
  )
    throw Error('Invalid price operation');
  const value = kind === 'reset' ? 0 : amount(input.value);
  if (kind === 'decrease_percent' && value >= 10000)
    throw Error('Price reduction must be less than 100%');
  if (kind === 'increase_percent' && value > 100000)
    throw Error('Price increase cannot exceed 1000%');
  return { kind, value };
}
function changePrice(product, op) {
  const old = Math.round(Number(product.price) * 100);
  let next;
  switch (op.kind) {
    case 'reset':
      if (product.source !== 'carparts' || product.carpartsPriceCents == null)
        throw Error('Only Checkmate products with a source price can resume price sync');
      next = product.carpartsPriceCents;
      break;
    case 'set':
      next = op.value;
      break;
    case 'increase_amount':
      next = old + op.value;
      break;
    case 'decrease_amount':
      next = old - op.value;
      break;
    case 'increase_percent':
      next = Math.round((old * (10000 + op.value)) / 10000);
      break;
    case 'decrease_percent':
      next = Math.round((old * (10000 - op.value)) / 10000);
      break;
    default:
      throw Error('Invalid operation');
  }
  if (!Number.isSafeInteger(next) || next < 1 || next > MAX_CENTS)
    throw Error(`Invalid resulting price for product ${product.id}; no prices changed`);
  if (product.source === 'legacy') throw Error('Archived eBay products cannot be repriced');
  return {
    id: product.id,
    name: product.name,
    before: old,
    after: next,
    source: product.source,
    sourcePrice: product.carpartsPriceCents,
    overrideBefore: product.priceOverrideCents,
    overrideAfter: product.source === 'carparts' && op.kind !== 'reset' ? next : null,
  };
}
module.exports = { amount, operation, changePrice, MAX_CENTS };
