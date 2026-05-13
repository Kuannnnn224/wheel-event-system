'use strict';

const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const AuthRoutes = require('./auth-routes');
const AwardOverridesRoutes = require('./award-overrides-routes');
const PlayersRoutes = require('./players-routes');
const ProbabilityRoutes = require('./probability-routes');
const ProbabilityImportsRoutes = require('./probability-imports-routes');
const ReportsRoutes = require('./reports-routes');
const SimulationsRoutes = require('./simulations-routes');
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
    new AuthRoutes(routeContext),
    new PlayersRoutes(routeContext),
    new ProbabilityRoutes(routeContext),
    new ProbabilityImportsRoutes(routeContext),
    new AwardOverridesRoutes(routeContext),
    new SpinsRoutes(routeContext),
    new WebviewSessionRoutes(routeContext),
    new ReportsRoutes(routeContext),
    new SimulationsRoutes(routeContext)
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
    container: options.container,
    requireAdmin: auth.requireAdmin(options.config),
    upload: multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024
      }
    })
  };
}

module.exports = createApiRouter;
