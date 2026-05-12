'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * Routes for public/admin demo webview sessions.
 */
class DemoRoutes {
  /**
   * @param {{ container: import('../container'), requireAdmin: Function, requirePlatformApiKey: Function }} context
   */
  constructor(context) {
    this.demoController = context.container.demoController;
    this.requireAdmin = context.requireAdmin;
    this.requirePlatformApiKey = context.requirePlatformApiKey;
  }

  /**
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post('/demo/session', this.requirePlatformApiKey, AsyncHandler.wrap((req, res, next) => this.demoController.createSession(req, res, next)));
    router.post('/demo/admin-session', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.demoController.createAdminSession(req, res, next)));
    router.get('/demo/client-config', AsyncHandler.wrap((req, res, next) => this.demoController.getClientConfig(req, res, next)));
    router.get('/demo/session', AsyncHandler.wrap((req, res, next) => this.demoController.getSession(req, res, next)));
  }
}

module.exports = DemoRoutes;
