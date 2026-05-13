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
    const adminHtml = await getText(base, '/');
    const webviewHtml = await getText(base, '/webview.html');

    assertContains(adminHtml, '<div id="root"></div>', 'admin page root');
    assertContains(webviewHtml, '100% Winning Bronze Spin', 'webview page marker');

    console.log(JSON.stringify({
      ok: true,
      service: 'wheel-event-backend-node8',
      port: address.port,
      health: health,
      apiHealth: apiHealth,
      staticPages: {
        admin: true,
        webview: true
      }
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
  return getText(base, path).then(function (body) {
    try {
      return JSON.parse(body);
    } catch (err) {
      throw new Error(path + ' returned invalid JSON: ' + err.message);
    }
  });
}

/**
 * @param {{ host: string, port: number }} base
 * @param {string} path
 * @returns {Promise<string>}
 */
function getText(base, path) {
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

        resolve(body);
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
 * @param {string} body
 * @param {string} expected
 * @param {string} label
 * @returns {void}
 */
function assertContains(body, expected, label) {
  if (body.indexOf(expected) === -1) {
    throw new Error('Missing ' + label + ' in HTTP smoke response.');
  }
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
