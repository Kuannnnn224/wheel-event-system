'use strict';

const createApp = require('./src/app');
const config = require('./src/config');

const app = createApp({ config: config });

const server = app.listen(config.port, config.host, function () {
  const address = server.address();
  const bind = typeof address === 'string' ? address : address.address + ':' + address.port;
  console.log('Node 8 backend skeleton listening on ' + bind);
});

function shutdown(signal) {
  console.log(signal + ' received, closing HTTP server.');
  server.close(function () {
    process.exit(0);
  });
}

process.on('SIGINT', function () {
  shutdown('SIGINT');
});

process.on('SIGTERM', function () {
  shutdown('SIGTERM');
});
