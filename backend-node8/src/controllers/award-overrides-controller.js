'use strict';

/**
 * 指定派獎 API 的 Express controller。
 */
class AwardOverridesController {
  /**
   * 初始化指定派獎 controller，保存指定派獎 service。
   *
   * @param {import('../services/award-overrides-service')} awardOverridesService
   */
  constructor(awardOverridesService) {
    this.awardOverridesService = awardOverridesService;
  }

  /**
   * 處理列表查詢 request，回傳符合條件的資料。
   *
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
   * 處理建立 request，將 body 交給 service 執行。
   *
   * @param {{ body?: Object, admin?: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async create(req, res) {
    res.json({ rules: await this.awardOverridesService.create(req.body || {}, req.admin ? req.admin.sub : undefined) });
  }

  /**
   * 處理取消 request，將 id 與 admin 身分交給 service。
   *
   * @param {{ params: Object, admin?: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async cancel(req, res) {
    res.json({ rule: await this.awardOverridesService.cancel(req.params.id, req.admin ? req.admin.sub : undefined) });
  }
}

module.exports = AwardOverridesController;
