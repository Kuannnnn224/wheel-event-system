'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * Routes for player admin lookup and progress inspection.
 */
class PlayersRoutes {
  /**
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.playersController = context.container.playersController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.get('/players', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.playersController.search(req, res, next)));
    router.get(
      '/players/:id/daily-progress',
      this.requireAdmin,
      AsyncHandler.wrap((req, res, next) => this.playersController.getDailyProgress(req, res, next))
    );
  }
}

module.exports = PlayersRoutes;
