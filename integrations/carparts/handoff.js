function validHandoff(result, payload) {
  if (!result?.ok || result.orderId !== payload.orderId || !/^[1-9]\d*$/.test(String(result.workOrder)) ||
      result.taxCents !== 0 || result.subtotalCents !== payload.lines.reduce((n,l) => n + l.priceCents, 0)) return false;
  if (['work_order','already_work_order'].includes(result.state))
    return result.invoice == null && result.finalized === false && result.lineCount === payload.lines.length;
  // A previously posted v1 request may be reconciled read-only after the cutover.
  return payload.version === 1 && result.state === 'already_posted' && /^[1-9]\d*$/.test(String(result.invoice));
}
module.exports = { validHandoff };
