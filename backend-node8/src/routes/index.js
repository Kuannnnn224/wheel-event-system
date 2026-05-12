'use strict';

const express = require('express');
const ApiStubRoutes = require('./api-stubs');

function createApiRouter(options) {
  const router = express.Router();
  const apiStubRoutes = new ApiStubRoutes(options);

  router.get('/health', function (_req, res) {
    res.json({
      ok: true,
      service: 'wheel-event-backend-node8-api'
    });
  });

  apiStubRoutes.register(router);

  return router;
}

module.exports = createApiRouter;
