require('../../utils/loadEnvironment');
const { sequelize } = require('../../db');
const { CarpartsSyncState } = require('../../models/models');
const { syncCatalog } = require('./catalog');
const { transferImages, imageStatus } = require('./images');
const { processSales, reconcileReservations } = require('./sales');
let stopping = false;
const timers = new Set(),
  active = new Set();
function loop(name, delay, fn) {
  let failures = 1;
  async function tick() {
    if (stopping) return;
    let nextDelay = delay;
    const task = (async () => {
      try {
        const result = await fn();
        if (result && !result.disabled && result.processed !== 0)
          console.log(`[CarParts ${name}]`, JSON.stringify(result));
        if (failures) await CarpartsSyncState.destroy({ where: { id: `error:${name}` } });
        failures = 0;
        if (result?.processed === 0 && name.startsWith('images-')) nextDelay = 30000;
      } catch (error) {
        failures++;
        nextDelay = Math.max(delay, Math.min(300000, 10000 * 2 ** Math.min(failures, 5)));
        console.error(`[CarParts ${name}]`, error.message);
        await CarpartsSyncState.upsert({
          id: `error:${name}`,
          data: { time: new Date().toISOString(), message: error.message.slice(0, 2000) },
        }).catch(() => {});
      }
    })();
    active.add(task);
    await task;
    active.delete(task);
    if (!stopping) {
      const timer = setTimeout(() => {
        timers.delete(timer);
        tick();
      }, nextDelay);
      timers.add(timer);
    }
  }
  tick();
}
(async () => {
  await sequelize.authenticate();
  loop('catalog', Number(process.env.CARPARTS_SYNC_INTERVAL_MS) || 300000, () =>
    syncCatalog({ stageOnly: process.env.CARPARTS_STAGE_ONLY === 'true' }),
  );
  // Bound background SSH sessions so live checkout probes retain capacity.
  const lanes = Math.max(1, Math.min(8, Math.floor(Number(process.env.CARPARTS_IMAGE_WORKERS)) || 4));
  for (let lane = 0; lane < lanes; lane++) {
    let shard = lane;
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!stopping) loop(`images-${lane}`, 1000, () => {
        const current = shard;
        shard = shard + lanes < 8 ? shard + lanes : lane;
        return transferImages(current);
      });
    }, 1500 + lane * 700);
    timers.add(timer);
  }
  loop('image-status', 60000, imageStatus);
  loop('sales', 5000, processSales);
  loop('reservations', 60000, reconcileReservations);
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
async function stop() {
  if (stopping) return;
  stopping = true;
  for (const t of timers) clearTimeout(t);
  await Promise.allSettled([...active]);
  await sequelize.close();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
