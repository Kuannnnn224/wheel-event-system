'use strict';

const HttpError = require('../utils/http-error');

/**
 * demo webview token API 的 Express controller。
 */
class DemoController {
  /**
   * 初始化 demo controller，保存 demo token service。
   *
   * @param {import('../services/demo-token-service')} demoTokenService
   */
  constructor(demoTokenService) {
    this.demoTokenService = demoTokenService;
  }

  /**
   * 建立平台 webview session 與玩家 token。
   *
   * @param {{ body: Object, headers: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async createSession(req, res) {
    res.json(await this.demoTokenService.createSession(req.body, this.getRequestContext(req)));
  }

  /**
   * 由後控建立 demo webview session。
   *
   * @param {{ body: Object, headers: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async createAdminSession(req, res) {
    res.json(await this.demoTokenService.createSession(req.body, this.getRequestContext(req)));
  }

  /**
   * 回傳 webview 前端啟動時需要的公開設定。
   *
   * @param {Object} _req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getClientConfig(_req, res) {
    res.json(this.demoTokenService.getClientConfig());
  }

  /**
   * 依 token 查詢 webview session 狀態。
   *
   * @param {{ query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getSession(req, res) {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      throw HttpError.badRequest('token is required.');
    }

    res.json(await this.demoTokenService.getSessionState(token));
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

module.exports = DemoController;
