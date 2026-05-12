'use strict';

const express = require('express');
const registerApiStubs = require('./api-stubs');

function createApiRouter(options) {
  const router = express.Router();

  router.get('/health', function (_req, res) {
    res.json({
      ok: true,
      service: 'wheel-event-backend-node8-api'
    });
  });

  registerApiStubs(router, options);

  return router;
}

module.exports = createApiRouter;
