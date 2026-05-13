'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * 後控玩家查詢與進度檢視相關 routes。
 */
class PlayersRoutes {
  /**
   * 初始化玩家 routes，保存 route context。
   *
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.playersController = context.container.playersController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
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
