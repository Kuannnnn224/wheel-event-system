'use strict';

/**
 * 模擬任務 API 的 Express controller。
 */
class SimulationsController {
  /**
   * 初始化模擬 controller，保存模擬 service。
   *
   * @param {import('../services/simulations-service')} simulationsService
   */
  constructor(simulationsService) {
    this.simulationsService = simulationsService;
  }

  /**
   * 處理建立 request，將 body 交給 service 執行。
   *
   * @param {{ body?: Object }} req
   * @param {{ json: Function }} res
   * @returns {void}
   */
  create(req, res) {
    res.json(this.simulationsService.createJob(req.body || {}));
  }

  /**
   * 取得指定條件下的資料。
   *
   * @param {{ params: Object }} req
   * @param {{ json: Function }} res
   * @returns {void}
   */
  get(req, res) {
    res.json(this.simulationsService.getJob(req.params.id));
  }
}

module.exports = SimulationsController;
