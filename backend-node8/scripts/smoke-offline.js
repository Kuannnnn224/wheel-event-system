'use strict';

const createApp = require('../src/app');
const config = require('../src/config');
const Container = require('../src/container');

async function main() {
  const container = new Container(config);

  try {
    const probabilityConfig = await container.probabilityService.getConfig();
    const app = createApp({
      config: config,
      container: container
    });

    console.log(JSON.stringify({
      ok: true,
      service: 'wheel-event-backend-node8',
      node: process.version,
      port: config.port,
      database: config.db.database,
      routeCount: countRoutes(app),
      probability: {
        dailyPayoutLimitPoints: probabilityConfig.dailyPayoutLimitPoints,
        stageCount: probabilityConfig.stages.length
      }
    }, null, 2));
  } finally {
    await container.db.close();
  }
}

/**
 * @param {Function & {_router?: Object}} app
 * @returns {number}
 */
function countRoutes(app) {
  if (!app || !app._router || !app._router.stack) {
    return 0;
  }

  return countLayerRoutes(app._router.stack);
}

/**
 * @param {Object[]} layers
 * @returns {number}
 */
function countLayerRoutes(layers) {
  let count = 0;

  layers.forEach(function (layer) {
    if (layer.route) {
      count += 1;
      return;
    }

    if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      count += countLayerRoutes(layer.handle.stack);
    }
  });

  return count;
}

main().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
