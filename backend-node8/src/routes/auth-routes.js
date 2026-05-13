'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * 後控登入驗證相關 routes。
 */
class AuthRoutes {
  /**
   * 初始化登入驗證 routes，保存 route context。
   *
   * @param {{ container: import('../container') }} context
   */
  constructor(context) {
    this.authController = context.container.authController;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post('/auth/login', AsyncHandler.wrap((req, res, next) => this.authController.login(req, res, next)));
  }
}

module.exports = AuthRoutes;
