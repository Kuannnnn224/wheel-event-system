'use strict';

const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const requirePlatformApiKey = require('../middleware/platform-api-key');
const AuthRoutes = require('./auth-routes');
const AwardOverridesRoutes = require('./award-overrides-routes');
const DemoRoutes = require('./demo-routes');
const PlayersRoutes = require('./players-routes');
const ProbabilityRoutes = require('./probability-routes');
const ProbabilityImportsRoutes = require('./probability-imports-routes');
const ReportsRoutes = require('./reports-routes');
const SimulationsRoutes = require('./simulations-routes');
const SpinsRoutes = require('./spins-routes');

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
    new DemoRoutes(routeContext),
    new ReportsRoutes(routeContext),
    new SimulationsRoutes(routeContext)
  ].forEach(function (routes) {
    routes.register(router);
  });

  return router;
}

function createRouteContext(options) {
  return {
    config: options.config,
    container: options.container,
    requireAdmin: auth.requireAdmin(options.config),
    requirePlatformApiKey: requirePlatformApiKey(options.config),
    upload: multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024
      }
    })
  };
}

module.exports = createApiRouter;
