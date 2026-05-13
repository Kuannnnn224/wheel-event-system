'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * 機率模擬任務相關 routes。
 */
class SimulationsRoutes {
  /**
   * 初始化模擬 routes，保存 route context。
   *
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.simulationsController = context.container.simulationsController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post('/simulations', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.simulationsController.create(req, res, next)));
    router.get('/simulations/:id', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.simulationsController.get(req, res, next)));
  }
}

module.exports = SimulationsRoutes;
