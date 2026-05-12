'use strict';

/**
 * Express controller for player admin endpoints.
 */
class PlayersController {
  /**
   * @param {import('../services/players-service')} playersService
   */
  constructor(playersService) {
    this.playersService = playersService;
    this.search = this.search.bind(this);
    this.getDailyProgress = this.getDailyProgress.bind(this);
  }

  /**
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
