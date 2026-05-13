'use strict';

/**
 * 機率設定查詢 API 的 Express controller。
 */
class ProbabilityController {
  /**
   * 初始化機率 controller，保存機率 service。
   *
   * @param {import('../services/probability-service')} probabilityService
   */
  constructor(probabilityService) {
    this.probabilityService = probabilityService;
  }

  /**
   * 回傳目前檔案中的完整機率設定。
   *
   * @param {Object} _req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getConfig(_req, res) {
    res.json(await this.probabilityService.getConfig());
  }

  /**
   * 回傳前端需要的階段機率設定。
   *
   * @param {Object} _req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getStages(_req, res) {
    res.json(await this.probabilityService.getStages());
  }
}

module.exports = ProbabilityController;
