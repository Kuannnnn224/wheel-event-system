'use strict';

/**
 * Express controller for report endpoints.
 */
class ReportsController {
  /**
   * @param {import('../services/reports-service')} reportsService
   */
  constructor(reportsService) {
    this.reportsService = reportsService;
    this.getDaily = this.getDaily.bind(this);
    this.getRange = this.getRange.bind(this);
    this.getPlayer = this.getPlayer.bind(this);
  }

  /**
   * @param {{ query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getDaily(req, res) {
    res.json(await this.reportsService.getDailyReport(req.query.date));
  }

  /**
   * @param {{ query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getRange(req, res) {
    res.json(await this.reportsService.getRangeReport(req.query.startDate, req.query.endDate));
  }

  /**
   * @param {{ query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getPlayer(req, res) {
    res.json(await this.reportsService.getPlayerReport(req.query.externalId, req.query.startDate, req.query.endDate));
  }
}

module.exports = ReportsController;
