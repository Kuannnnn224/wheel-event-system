'use strict';

const path = require('path');
const fs = require('fs');
const cors = require('cors');
const express = require('express');
const createApiRouter = require('./routes');
const errorHandler = require('./middleware/error-handler');
const notFound = require('./middleware/not-found');

/**
 * 建立 Express app，掛上共用 middleware、API routes 與靜態檔服務。
 *
 * @param {{ config: Object, container: Object }} options
 * @returns {import('express').Express}
 */
function createApp(options) {
  const config = options.config;
  const container = options.container;
  const app = express();

  app.disable('x-powered-by');

  app.use(cors({
    origin: config.corsOrigins.length ? config.corsOrigins : true,
    credentials: true
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', health(config));

  const apiRouter = createApiRouter({
    config: config,
    container: container
  });
  app.use('/api', apiRouter);

  // Keep compatibility for clients that call the API without the /api prefix.
  app.use(apiRouter);

  attachPublicStatic(app, config);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

/**
 * 建立 health check handler，回傳服務狀態與目前 Node 環境。
 *
 * @param {Object} config
 * @returns {Function}
 */
function health(config) {
  return function (_req, res) {
    res.json({
      ok: true,
      service: 'wheel-event-backend-node8',
      node: process.version,
      env: config.nodeEnv
    });
  };
}

/**
 * 如果 public 靜態目錄存在，就掛上後控與 webview 靜態檔，以及後控 SPA fallback。
 *
 * @param {import('express').Express} app
 * @param {Object} config
 * @returns {void}
 */
function attachPublicStatic(app, config) {
  if (!directoryExists(config.publicPath)) {
    return;
  }

  app.use(express.static(config.publicPath));
  app.get('*', function (req, res, next) {
    if (req.path.indexOf('/api/') === 0) {
      return next();
    }

    res.sendFile(path.join(config.publicPath, 'index.html'));
  });
}

/**
 * 檢查指定路徑是否存在且為資料夾。
 *
 * @param {string} targetPath
 * @returns {boolean}
 */
function directoryExists(targetPath) {
  try {
    return fs.statSync(targetPath).isDirectory();
  } catch (_err) {
    return false;
  }
}

module.exports = createApp;
