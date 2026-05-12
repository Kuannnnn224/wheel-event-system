'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * Routes for admin reports.
 */
class ReportsRoutes {
  /**
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.reportsController = context.container.reportsController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.get('/reports/daily', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.reportsController.getDaily(req, res, next)));
    router.get('/reports/range', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.reportsController.getRange(req, res, next)));
    router.get('/reports/player', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.reportsController.getPlayer(req, res, next)));
  }
}

module.exports = ReportsRoutes;
