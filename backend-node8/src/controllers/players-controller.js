'use strict';

/**
 * 玩家後控查詢 API 的 Express controller。
 */
class PlayersController {
  /**
   * 初始化玩家 controller，保存玩家 service。
   *
   * @param {import('../services/players-service')} playersService
   */
  constructor(playersService) {
    this.playersService = playersService;
  }

  /**
   * 依 query 查詢玩家資料。
   *
   * @param {{ query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async search(req, res) {
    const externalId = typeof req.query.externalId === 'string' ? req.query.externalId : '';

    if (externalId) {
      res.json({ player: await this.playersService.findByExternalId(externalId) });
      return;
    }

    res.json({ players: await this.playersService.listPlayers(req.query.limit) });
  }

  /**
   * 查詢玩家指定日期的流水與抽獎進度。
   *
   * @param {{ params: Object, query: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getDailyProgress(req, res) {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;
    res.json(await this.playersService.getDailyProgress(req.params.id, date));
  }
}

module.exports = PlayersController;
