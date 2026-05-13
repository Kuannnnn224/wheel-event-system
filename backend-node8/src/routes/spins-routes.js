'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * 抽獎模擬與 public 真實抽獎相關 routes。
 */
class SpinsRoutes {
  /**
   * 初始化抽獎 routes，保存 route context。
   *
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.spinsController = context.container.spinsController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post('/spins/simulate', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.spinsController.simulate(req, res, next)));
    router.post('/spins/real', AsyncHandler.wrap((req, res, next) => this.spinsController.realSpin(req, res, next)));
  }
}

module.exports = SpinsRoutes;
