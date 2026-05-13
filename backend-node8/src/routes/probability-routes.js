'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * 機率設定檢視相關 routes。
 */
class ProbabilityRoutes {
  /**
   * 初始化機率設定 routes，保存 route context。
   *
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.probabilityController = context.container.probabilityController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.get('/probability/config', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.probabilityController.getConfig(req, res, next)));
    router.get('/probability/stages', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.probabilityController.getStages(req, res, next)));
    router.put('/probability/stages', this.requireAdmin, probabilityStagesForbidden());
  }
}

/**
 * 拒絕舊版不再支援的 probability stages 寫入路由。
 *
 * @returns {Function}
 */
function probabilityStagesForbidden() {
  return function (_req, res) {
    res.status(403).json({ message: '機率設定只能透過機率表 ZIP 匯入，不允許手動更新。' });
  };
}

module.exports = ProbabilityRoutes;
