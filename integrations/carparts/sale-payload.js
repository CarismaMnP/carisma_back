function salePayload(order, items, jobs) {
  const customer = {
    name: String(order.fullName || '').trim(),
    email: String(order.mail || '').trim(),
    phone: String(order.phone || '').trim(),
    billing: order.billingAddress || {},
    shipping: order.shippingAddress || {
      line1: order.address_line_1, line2: order.address_line_2,
      city: order.city, state: order.addressState,
      postal_code: order.zip_code, country: order.country,
    },
  };
  if (!customer.name || !customer.email) throw Error('Customer name and email required');
  const lines = jobs.map(job => {
    const item = items.find(i => i.productId === job.productId);
    const s = item?.productSnapshot;
    if (!s || s.source !== 'carparts' || s.guid !== job.guid || s.inventoryId !== job.inventoryId ||
        s.tag !== job.tag || item.count !== 1 || !Number.isSafeInteger(item.unitPriceCents) || item.unitPriceCents <= 0)
      throw Error('Captured checkout price or inventory identity missing; manual review required');
    if (!Number.isSafeInteger(item.discountCents || 0) || (item.discountCents || 0) < 0 || (item.discountCents || 0) >= item.unitPriceCents)
      throw Error('Invalid captured line discount');
    return { guid: job.guid, inventoryId: job.inventoryId, tag: job.tag,
      priceCents: item.unitPriceCents - (item.discountCents || 0), quantity: 1, name: s.name };
  }).sort((a,b) => a.guid.localeCompare(b.guid));
  if (!lines.length || new Set(lines.map(l => l.guid)).size !== lines.length)
    throw Error('Invalid sale lines');
  const cents = value => Math.round(Number(value || 0) * 100);
  return { version: 2, action: 'createSale', fulfillment: 'work_order', orderId: order.id, paidLive: order.paidLive,
    isIntegrationTest: !!order.isIntegrationTest, paidAt: new Date(order.paidAt).toISOString(),
    createdAt: new Date(order.createdAt).toISOString(), customer, lines,
    websiteTaxCents: cents(order.tax), websiteTotalCents: cents(order.total),
    websiteShippingCents: cents(order.shippingAmount), paymentIntentId: order.stripePaymentIntentId || null,
    taxMode: 'not_taxable', currency: 'USD' };
}
module.exports = { salePayload };
