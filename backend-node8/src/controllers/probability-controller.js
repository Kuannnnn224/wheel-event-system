'use strict';

/**
 * Express controller for probability configuration endpoints.
 */
class ProbabilityController {
  /**
   * @param {import('../services/probability-service')} probabilityService
   */
  constructor(probabilityService) {
    this.probabilityService = probabilityService;
    this.getConfig = this.getConfig.bind(this);
    this.getStages = this.getStages.bind(this);
  }

  /**
   * @param {Object} _req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getConfig(_req, res) {
    res.json(await this.probabilityService.getConfig());
  }

  /**
   * @param {Object} _req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getStages(_req, res) {
    res.json(await this.probabilityService.getStages());
  }
}

module.exports = ProbabilityController;
