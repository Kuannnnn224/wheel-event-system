'use strict';

const http = require('http');
const createApp = require('../src/app');
const config = require('../src/config');
const Container = require('../src/container');

async function main() {
  const container = new Container(config);
  let server = null;

  try {
    await container.authService.ensureInitialAdmin();

    server = await listen(createApp({
      config: config,
      container: container
    }));

    const address = server.address();
    const base = {
      host: '127.0.0.1',
      port: address.port
    };

    const health = await getJson(base, '/health');
    const apiHealth = await getJson(base, '/api/health');

    console.log(JSON.stringify({
      ok: true,
      service: 'wheel-event-backend-node8',
      port: address.port,
      health: health,
      apiHealth: apiHealth
    }, null, 2));
  } finally {
    await closeServer(server);
    await container.db.close();
  }
}

/**
 * @param {Function} app
 * @returns {Promise<Object>}
 */
function listen(app) {
  return new Promise(function (resolve, reject) {
    const server = app.listen(0, '127.0.0.1');

    server.on('listening', function () {
      resolve(server);
    });
    server.on('error', reject);
  });
}

/**
 * @param {{ host: string, port: number }} base
 * @param {string} path
 * @returns {Promise<Object>}
 */
function getJson(base, path) {
  return new Promise(function (resolve, reject) {
    const req = http.get({
      hostname: base.host,
      port: base.port,
      path: path,
      timeout: 5000
    }, function (res) {
      let body = '';

      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(path + ' returned HTTP ' + res.statusCode + ': ' + body));
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(path + ' returned invalid JSON: ' + err.message));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(5000, function () {
      req.abort();
      reject(new Error(path + ' timed out.'));
    });
  });
}

/**
 * @param {Object|null} server
 * @returns {Promise<void>}
 */
function closeServer(server) {
  if (!server) {
    return Promise.resolve();
  }

  return new Promise(function (resolve, reject) {
    server.close(function (err) {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

main().catch(function (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
