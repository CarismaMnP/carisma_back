const { sequelize } = require('../../db');
async function withLock(key, fn) {
  const c = await sequelize.connectionManager.getConnection({ type: 'WRITE' });
  let held = false;
  try {
    held = (await c.query('SELECT pg_try_advisory_lock($1) AS held', [key])).rows[0].held;
    if (!held) return { skipped: 'another worker holds the lock' };
    return await fn();
  } finally {
    try {
      if (held) await c.query('SELECT pg_advisory_unlock($1)', [key]);
    } catch (error) {
      await sequelize.connectionManager.destroyConnection(c);
      throw error;
    }
    await sequelize.connectionManager.releaseConnection(c);
  }
}
module.exports = { withLock };
