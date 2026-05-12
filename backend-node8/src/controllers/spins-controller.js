'use strict';

/**
 * Express controller for spin endpoints.
 */
class SpinsController {
  /**
   * @param {import('../services/spins-service')} spinsService
   */
  constructor(spinsService) {
    this.spinsService = spinsService;
    this.simulate = this.simulate.bind(this);
  }

  /**
   * @param {{ body?: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async simulate(req, res) {
    res.json(await this.spinsService.simulate(req.body || {}));
  }
}

module.exports = SpinsController;
