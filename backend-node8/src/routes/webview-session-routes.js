'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * app/public webview session 與開發環境後控 webview 工具 routes。
 */
class WebviewSessionRoutes {
  /**
   * 初始化 routes，保存 route context。
   *
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.webviewSessionController = context.container.webviewSessionController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post('/webview/sessions', AsyncHandler.wrap((req, res, next) => this.webviewSessionController.createAppSession(req, res, next)));
    router.post('/admin/webview-sessions', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.webviewSessionController.createAdminSession(req, res, next)));
    router.get('/webview/client-config', AsyncHandler.wrap((req, res, next) => this.webviewSessionController.getClientConfig(req, res, next)));
    router.get('/webview/game-config', AsyncHandler.wrap((req, res, next) => this.webviewSessionController.getGameConfig(req, res, next)));
    router.get('/webview/sessions/current', AsyncHandler.wrap((req, res, next) => this.webviewSessionController.getCurrentSession(req, res, next)));
  }
}

module.exports = WebviewSessionRoutes;
