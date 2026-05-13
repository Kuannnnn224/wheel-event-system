'use strict';

/**
 * 後控登入驗證 API 的 Express controller。
 */
class AuthController {
  /**
   * 初始化驗證 controller，保存 auth service。
   *
   * @param {import('../services/auth-service')} authService
   */
  constructor(authService) {
    this.authService = authService;
  }

  /**
   * 處理管理員登入 request，呼叫 service 後回傳 token。
   *
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
