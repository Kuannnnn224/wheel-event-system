'use strict';

/**
 * 抽獎 API 的 Express controller。
 */
class SpinsController {
  /**
   * 初始化抽獎 controller，保存抽獎 service。
   *
   * @param {import('../services/spins-service')} spinsService
   */
  constructor(spinsService) {
    this.spinsService = spinsService;
  }

  /**
   * 處理 webview 真實抽獎 request，會寫入抽獎紀錄。
   *
   * @param {{ body?: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async realSpin(req, res) {
    res.json(await this.spinsService.realSpin(req.body || {}));
  }
}

module.exports = SpinsController;
