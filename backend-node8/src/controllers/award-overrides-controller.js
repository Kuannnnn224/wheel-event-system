'use strict';

/**
 * Express controller for award override endpoints.
 */
class AwardOverridesController {
  /**
   * @param {import('../services/award-overrides-service')} awardOverridesService
   */
  constructor(awardOverridesService) {
    this.awardOverridesService = awardOverridesService;
  }

  /**
   * @param {{ query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async list(req, res) {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const externalId = typeof req.query.externalId === 'string' ? req.query.externalId : undefined;
    res.json({ rules: await this.awardOverridesService.list(status, externalId) });
  }

  /**
   * @param {{ body?: Object, admin?: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async create(req, res) {
    res.json({ rules: await this.awardOverridesService.create(req.body || {}, req.admin ? req.admin.sub : undefined) });
  }

  /**
   * @param {{ params: Object, admin?: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async cancel(req, res) {
    res.json({ rule: await this.awardOverridesService.cancel(req.params.id, req.admin ? req.admin.sub : undefined) });
  }
}

module.exports = AwardOverridesController;
