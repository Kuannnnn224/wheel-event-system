'use strict';

const HttpError = require('../utils/http-error');

/**
 * Express controller for demo webview token endpoints.
 */
class DemoController {
  /**
   * @param {import('../services/demo-token-service')} demoTokenService
   * @param {Object} config
   */
  constructor(demoTokenService, config) {
    this.demoTokenService = demoTokenService;
    this.config = config;
    this.createSession = this.createSession.bind(this);
    this.createAdminSession = this.createAdminSession.bind(this);
    this.getClientConfig = this.getClientConfig.bind(this);
    this.getSession = this.getSession.bind(this);
  }

  /**
   * @param {{ body: Object, headers: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async createSession(req, res) {
    this.assertPlatformApiKey(req.headers['x-platform-api-key']);
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

  /**
   * @param {string|undefined} apiKey
   * @returns {void}
   */
  assertPlatformApiKey(apiKey) {
    const expectedApiKey = this.config && this.config.platformApiKey ? String(this.config.platformApiKey).trim() : '';

    if (!expectedApiKey || apiKey !== expectedApiKey) {
      throw HttpError.unauthorized('Invalid platform API key.');
    }
  }
}

module.exports = DemoController;
