'use strict';

const http = require('http');
const createApp = require('../src/app');
const config = require('../src/config');
const Container = require('../src/container');

async function main() {
  const container = new Container(config);
  let server = null;

  try {
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
    const gameConfig = await getJson(base, '/api/webview/game-config');
    const webviewSession = await postJson(base, '/api/webview/sessions', {
      playerId: 'smoke-player',
      turnoverPoints: 999999,
      unlockedStage: 5
    });
    const currentSession = await getJson(base, '/api/webview/sessions/current?token=' + encodeURIComponent(webviewSession.token));
    const webviewHtml = await getText(base, '/webview.html');

    assertContains(webviewHtml, '100% Winning Bronze Spin', 'webview page marker');
    assertGameConfig(gameConfig);
    assertCurrentSession(currentSession);

    console.log(JSON.stringify({
      ok: true,
      service: 'wheel-event-backend-node8',
      port: address.port,
      health: health,
      apiHealth: apiHealth,
      gameConfig: {
        stageCount: gameConfig.stages.length
      },
      webviewSession: {
        playerId: currentSession.player.id,
        unlockedStage: currentSession.progress.unlockedStage
      },
      staticPages: {
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
 * @param {Object} body
 * @returns {Promise<Object>}
 */
function postJson(base, path, body) {
  return requestText(base, path, 'POST', JSON.stringify(body), {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  }).then(function (responseBody) {
    try {
      return JSON.parse(responseBody);
    } catch (err) {
      throw new Error(path + ' returned invalid JSON: ' + err.message);
    }
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
  return requestText(base, path, 'GET');
}

/**
 * @param {{ host: string, port: number }} base
 * @param {string} path
 * @param {string} method
 * @param {string|undefined} [body]
 * @param {Object|undefined} [headers]
 * @returns {Promise<string>}
 */
function requestText(base, path, method, body, headers) {
  return new Promise(function (resolve, reject) {
    const req = http.request({
      method: method,
      hostname: base.host,
      port: base.port,
      path: path,
      headers: headers || {},
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

    if (body) {
      req.write(body);
    }

    req.end();
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
 * @param {Object} gameConfig
 * @returns {void}
 */
function assertGameConfig(gameConfig) {
  if (!gameConfig || !Array.isArray(gameConfig.stages) || gameConfig.stages.length !== 5) {
    throw new Error('Invalid /api/webview/game-config response.');
  }
}

/**
 * @param {Object} currentSession
 * @returns {void}
 */
function assertCurrentSession(currentSession) {
  if (!currentSession || !currentSession.player || currentSession.player.id !== 'smoke-player') {
    throw new Error('Invalid /api/webview/sessions/current player response.');
  }

  if (!currentSession.progress || currentSession.progress.unlockedStage < 1) {
    throw new Error('Invalid /api/webview/sessions/current progress response.');
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
