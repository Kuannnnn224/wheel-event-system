'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * 正式 App/Webview 對接 routes。
 */
class WebviewSessionRoutes {
  /**
   * 初始化 routes，保存 route context。
   *
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.webviewSessionController = context.container.webviewSessionController;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post('/webview/sessions', AsyncHandler.wrap((req, res, next) => this.webviewSessionController.createAppSession(req, res, next)));
    router.get('/webview/game-config', AsyncHandler.wrap((req, res, next) => this.webviewSessionController.getGameConfig(req, res, next)));
    router.get('/webview/sessions/current', AsyncHandler.wrap((req, res, next) => this.webviewSessionController.getCurrentSession(req, res, next)));
  }
}

module.exports = WebviewSessionRoutes;
