'use strict';

/**
 * Express controller for simulation endpoints.
 */
class SimulationsController {
  /**
   * @param {import('../services/simulations-service')} simulationsService
   */
  constructor(simulationsService) {
    this.simulationsService = simulationsService;
    this.create = this.create.bind(this);
    this.get = this.get.bind(this);
  }

  /**
   * @param {{ body?: Object }} req
   * @param {{ json: Function }} res
   * @returns {void}
   */
  create(req, res) {
    res.json(this.simulationsService.createJob(req.body || {}));
  }

  /**
   * @param {{ params: Object }} req
   * @param {{ json: Function }} res
   * @returns {void}
   */
  get(req, res) {
    res.json(this.simulationsService.getJob(req.params.id));
  }
}

module.exports = SimulationsController;
