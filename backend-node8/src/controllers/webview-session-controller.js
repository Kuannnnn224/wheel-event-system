'use strict';

const HttpError = require('../utils/http-error');

/**
 * webview session API 的 Express controller。
 */
class WebviewSessionController {
  /**
   * 初始化 webview session controller，保存 service。
   *
   * @param {import('../services/webview-session-service')} webviewSessionService
   */
  constructor(webviewSessionService) {
    this.webviewSessionService = webviewSessionService;
  }

  /**
   * 由 app 建立正式 webview session。
   *
   * @param {{ body: Object, headers: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async createAppSession(req, res) {
    res.json(await this.webviewSessionService.createSession(req.body, this.getRequestContext(req)));
  }

  /**
   * 由後控工具建立 webview session。
   *
   * @param {{ body: Object, headers: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async createAdminSession(req, res) {
    this.assertAdminSessionCreationAllowed();
    res.json(await this.webviewSessionService.createSession(req.body, this.getRequestContext(req)));
  }

  /**
   * 回傳 webview 前端啟動時需要的公開設定。
   *
   * @param {Object} _req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getClientConfig(_req, res) {
    res.json(this.webviewSessionService.getClientConfig());
  }

  /**
   * 依 token 查詢 webview session 狀態。
   *
   * @param {{ query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getCurrentSession(req, res) {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      throw HttpError.badRequest('token is required.');
    }

    res.json(await this.webviewSessionService.getSessionState(token));
  }

  /**
   * 從 request header 取出 origin/referer，供 webview URL 組裝使用。
   *
   * @param {{ headers: Object }} req
   * @returns {{ origin: string|undefined, referer: string|undefined }}
   */
  getRequestContext(req) {
    return {
      origin: req.headers.origin,
      referer: req.headers.referer
    };
  }

  /**
   * 後控建立 webview 連結只允許開發環境，避免正式環境污染真實玩家資料。
   *
   * @returns {void}
   */
  assertAdminSessionCreationAllowed() {
    const nodeEnv = this.webviewSessionService.config.nodeEnv;
    if (nodeEnv !== 'development') {
      throw HttpError.forbidden('Admin webview sessions are only available in development.');
    }
  }
}

module.exports = WebviewSessionController;
