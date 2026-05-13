'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * 後控指定派獎規則相關 routes。
 */
class AwardOverridesRoutes {
  /**
   * 初始化指定派獎 routes，保存 route context。
   *
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.awardOverridesController = context.container.awardOverridesController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.get('/award-overrides', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.awardOverridesController.list(req, res, next)));
    router.post('/award-overrides', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.awardOverridesController.create(req, res, next)));
    router.patch(
      '/award-overrides/:id/cancel',
      this.requireAdmin,
      AsyncHandler.wrap((req, res, next) => this.awardOverridesController.cancel(req, res, next))
    );
  }
}

module.exports = AwardOverridesRoutes;
