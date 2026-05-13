'use strict';

/**
 * 報表 API 的 Express controller。
 */
class ReportsController {
  /**
   * 初始化報表 controller，保存報表 service。
   *
   * @param {import('../services/reports-service')} reportsService
   */
  constructor(reportsService) {
    this.reportsService = reportsService;
  }

  /**
   * 處理單日報表查詢 request。
   *
   * @param {{ query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getDaily(req, res) {
    res.json(await this.reportsService.getDailyReport(req.query.date));
  }

  /**
   * 處理日期區間報表查詢 request。
   *
   * @param {{ query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getRange(req, res) {
    res.json(await this.reportsService.getRangeReport(req.query.startDate, req.query.endDate));
  }

  /**
   * 處理指定玩家報表查詢 request。
   *
   * @param {{ query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getPlayer(req, res) {
    res.json(await this.reportsService.getPlayerReport(req.query.externalId, req.query.startDate, req.query.endDate));
  }
}

module.exports = ReportsController;
