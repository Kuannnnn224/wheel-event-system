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
    router.post('/demo/session', this.requirePlatformApiKey, AsyncHandler.wrap(this.demoController.createSession));
    router.post('/demo/admin-session', this.requireAdmin, AsyncHandler.wrap(this.demoController.createAdminSession));
    router.get('/demo/client-config', AsyncHandler.wrap(this.demoController.getClientConfig));
    router.get('/demo/session', AsyncHandler.wrap(this.demoController.getSession));
  }
}

module.exports = DemoRoutes;
