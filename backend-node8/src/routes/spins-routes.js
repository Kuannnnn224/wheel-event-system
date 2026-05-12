'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * Routes for spin simulation and public real spins.
 */
class SpinsRoutes {
  /**
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.spinsController = context.container.spinsController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post('/spins/simulate', this.requireAdmin, AsyncHandler.wrap(this.spinsController.simulate));
    router.post('/spins/real', AsyncHandler.wrap(this.spinsController.realSpin));
  }
}

module.exports = SpinsRoutes;
