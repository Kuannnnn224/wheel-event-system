'use strict';

const express = require('express');
const SpinsRoutes = require('./spins-routes');
const WebviewSessionRoutes = require('./webview-session-routes');

/**
 * 建立 /api router，集中註冊所有 route module。
 *
 * @param {{ config: Object, container: Object }} options
 * @returns {import('express').Router}
 */
function createApiRouter(options) {
  const router = express.Router();
  const routeContext = createRouteContext(options);

  router.get('/health', function (_req, res) {
    res.json({
      ok: true,
      service: 'wheel-event-backend-node8-api'
    });
  });

  [
    new SpinsRoutes(routeContext),
    new WebviewSessionRoutes(routeContext)
  ].forEach(function (routes) {
    routes.register(router);
  });

  return router;
}

/**
 * 建立各 route class 共用的 context，例如 middleware、container 與 upload 設定。
 *
 * @param {{ config: Object, container: Object }} options
 * @returns {Object}
 */
function createRouteContext(options) {
  return {
    config: options.config,
    container: options.container
  };
}

module.exports = createApiRouter;
