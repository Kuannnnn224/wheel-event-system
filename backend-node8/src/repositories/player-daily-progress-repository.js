'use strict';

/**
 * @typedef {Object} PlayerDailyProgress
 * @property {string} id
 * @property {string} playerId
 * @property {string} businessDate
 * @property {number} turnoverPoints
 * @property {number} unlockedStage
 */

/**
 * @typedef {Object} PlayerDailyProgressRow
 * @property {string} id
 * @property {string} player_id
 * @property {string} business_date
 * @property {number} turnover_points
 * @property {number} unlocked_stage
 */

/**
 * Raw SQL repository for `player_daily_progress`.
 */
class PlayerDailyProgressRepository {
  /**
   * @param {import('../db').DatabaseConnection} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * @param {string} playerId
   * @param {string} businessDate
   * @returns {Promise<PlayerDailyProgress|null>}
   */
  async findByPlayerAndDate(playerId, businessDate) {
    const row = await this.db.maybeOne(
      [
        'SELECT id, player_id, business_date, turnover_points, unlocked_stage',
        'FROM player_daily_progress',
        'WHERE player_id = ? AND business_date = ?',
        'LIMIT 1'
      ].join(' '),
      [playerId, businessDate]
    );

    return this.mapRow(row);
  }

  /**
   * @param {PlayerDailyProgressRow|null} row
   * @returns {PlayerDailyProgress|null}
   */
  mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      playerId: row.player_id,
      businessDate: row.business_date,
      turnoverPoints: row.turnover_points,
      unlockedStage: row.unlocked_stage
    };
  }
}

module.exports = PlayerDailyProgressRepository;
