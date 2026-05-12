'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * Routes for admin authentication.
 */
class AuthRoutes {
  /**
   * @param {{ container: import('../container') }} context
   */
  constructor(context) {
    this.authController = context.container.authController;
  }

  /**
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post('/auth/login', AsyncHandler.wrap(this.authController.login));
  }
}

module.exports = AuthRoutes;
