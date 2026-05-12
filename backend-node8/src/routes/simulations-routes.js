'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * Routes for probability simulation jobs.
 */
class SimulationsRoutes {
  /**
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.simulationsController = context.container.simulationsController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post('/simulations', this.requireAdmin, AsyncHandler.wrap(this.simulationsController.create));
    router.get('/simulations/:id', this.requireAdmin, AsyncHandler.wrap(this.simulationsController.get));
  }
}

module.exports = SimulationsRoutes;
