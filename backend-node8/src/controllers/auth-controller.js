'use strict';

/**
 * Express controller for admin authentication endpoints.
 */
class AuthController {
  /**
   * @param {import('../services/auth-service')} authService
   */
  constructor(authService) {
    this.authService = authService;
    this.login = this.login.bind(this);
  }

  /**
   * @param {{ body?: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async login(req, res) {
    const result = await this.authService.login(req.body || {});
    res.json(result);
  }
}

module.exports = AuthController;
