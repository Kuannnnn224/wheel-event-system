'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * 後控報表相關 routes。
 */
class ReportsRoutes {
  /**
   * 初始化報表 routes，保存 route context。
   *
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.reportsController = context.container.reportsController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
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
