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
    router.post('/spins/simulate', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.spinsController.simulate(req, res, next)));
    router.post('/spins/real', AsyncHandler.wrap((req, res, next) => this.spinsController.realSpin(req, res, next)));
  }
}

module.exports = SpinsRoutes;
