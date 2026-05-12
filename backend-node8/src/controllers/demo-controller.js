'use strict';

const HttpError = require('../utils/http-error');

/**
 * Express controller for demo webview token endpoints.
 */
class DemoController {
  /**
   * @param {import('../services/demo-token-service')} demoTokenService
   */
  constructor(demoTokenService) {
    this.demoTokenService = demoTokenService;
  }

  /**
   * @param {{ body: Object, headers: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async createSession(req, res) {
    res.json(await this.demoTokenService.createSession(req.body, this.getRequestContext(req)));
  }

  /**
   * @param {{ body: Object, headers: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async createAdminSession(req, res) {
    res.json(await this.demoTokenService.createSession(req.body, this.getRequestContext(req)));
  }

  /**
   * @param {Object} _req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getClientConfig(_req, res) {
    res.json(this.demoTokenService.getClientConfig());
  }

  /**
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
