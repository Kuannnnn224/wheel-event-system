'use strict';

const createApp = require('./src/app');
const config = require('./src/config');
const Container = require('./src/container');

let container = null;
let server = null;
let shuttingDown = false;

async function main() {
  container = new Container(config);
  await container.authService.ensureInitialAdmin();

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
