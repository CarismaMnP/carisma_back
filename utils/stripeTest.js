// Optional, short-lived operator test scope. No public request can enable it.
const fs = require('fs');
function testConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(process.env.STRIPE_TEST_CONFIG_FILE || '/etc/carisma/stripe-test.json','utf8'));
    const until = Date.parse(config.expiresAt);
    if (!Number.isFinite(until) || until <= Date.now() || until > Date.now()+24*3600000 ||
        !config.secretKey?.startsWith('sk_test_') || !config.webhookSecret?.startsWith('whsec_') ||
        !Array.isArray(config.orderIds) || config.orderIds.length>10) return null;
    return config;
  } catch (_) { return null; }
}
function authorizedStripeTest(orderId) {
  const config = testConfig();
  return !!config && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(orderId || '') && config.orderIds.includes(orderId);
}
function authorizedIntegrationTest(orderId) {
  return process.env.CARPARTS_TEST_ORDER_ID === orderId || authorizedStripeTest(orderId);
}
module.exports = {testConfig, authorizedStripeTest, authorizedIntegrationTest};
