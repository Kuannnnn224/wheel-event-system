'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * public/admin demo webview session 相關 routes。
 */
class DemoRoutes {
  /**
   * 初始化 demo routes，保存 route context。
   *
   * @param {{ container: import('../container'), requireAdmin: Function, requirePlatformApiKey: Function }} context
   */
  constructor(context) {
    this.demoController = context.container.demoController;
    this.requireAdmin = context.requireAdmin;
    this.requirePlatformApiKey = context.requirePlatformApiKey;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post('/demo/session', this.requirePlatformApiKey, AsyncHandler.wrap((req, res, next) => this.demoController.createSession(req, res, next)));
    router.post('/demo/admin-session', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.demoController.createAdminSession(req, res, next)));
    router.get('/demo/client-config', AsyncHandler.wrap((req, res, next) => this.demoController.getClientConfig(req, res, next)));
    router.get('/demo/session', AsyncHandler.wrap((req, res, next) => this.demoController.getSession(req, res, next)));
  }
}

module.exports = DemoRoutes;
