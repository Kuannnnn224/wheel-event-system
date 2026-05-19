'use strict';

const createApp = require('./src/app');
const config = require('./src/config');
const Container = require('./src/container');

let container = null;
let server = null;
let shuttingDown = false;

/**
 * 初始化 DI container、建立預設管理員，並啟動 HTTP server。
 *
 * @returns {Promise<void>}
 */
async function main() {
  container = new Container(config);

  const app = createApp({
    config: config,
    container: container
  });

  server = app.listen(config.port, config.host, function () {
    const address = server.address();
    const bind = typeof address === 'string' ? address : address.address + ':' + address.port;
    console.log('Node 8 backend listening on ' + bind);
  });
}

/**
 * 收到系統訊號時優雅關閉 HTTP server。
 *
 * @param {string} signal
 * @returns {void}
 */
function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(signal + ' received, closing HTTP server.');

  if (!server) {
    return closeDatabaseAndExit(0);
  }

  server.close(function (err) {
    if (err) {
      console.error(err && err.stack ? err.stack : err);
    }

    closeDatabaseAndExit(err ? 1 : 0);
  });
}

/**
 * 關閉資料庫連線後結束 process。
 *
 * @param {number} exitCode
 * @returns {void}
 */
function closeDatabaseAndExit(exitCode) {
  if (!container || !container.db) {
    process.exit(exitCode);
    return;
  }

  container.db.close().then(function () {
    process.exit(exitCode);
  }).catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

process.on('SIGINT', function () {
  shutdown('SIGINT');
});

process.on('SIGTERM', function () {
  shutdown('SIGTERM');
});

main().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  closeDatabaseAndExit(1);
});
