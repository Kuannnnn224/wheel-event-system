'use strict';

const HttpError = require('../utils/http-error');

/**
 * Webview 開頁與狀態 API 的 Express controller。
 */
class WebviewSessionController {
  /**
   * 初始化 webview controller，保存 service。
   *
   * @param {import('../services/webview-session-service')} webviewSessionService
   */
  constructor(webviewSessionService) {
    this.webviewSessionService = webviewSessionService;
  }

  /**
   * 由 App client 建立正式 webview URL。
   *
   * @param {{ body: Object, headers: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async createAppSession(req, res) {
    res.json(await this.webviewSessionService.createSession(req.body, this.getRequestContext(req)));
  }

  /**
   * 回傳 webview 轉盤渲染需要的階段與獎項設定。
   *
   * @param {Object} _req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getGameConfig(_req, res) {
    res.json(await this.webviewSessionService.getGameConfig());
  }

  /**
   * 依 token 查詢 webview 玩家狀態。
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
}

module.exports = WebviewSessionController;
