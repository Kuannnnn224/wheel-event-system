'use strict';

const ids = require('../utils/ids');

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
  async findByPlayerAndDate(playerId, businessDate, tx) {
    const row = await this.getDb(tx).maybeOne(
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
   * Inserts or raises current progress values without lowering existing values.
   *
   * @param {string} playerId
   * @param {string} businessDate
   * @param {number} turnoverPoints
   * @param {number} unlockedStage
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<PlayerDailyProgress|null>}
   */
  async upsertMaxProgress(playerId, businessDate, turnoverPoints, unlockedStage, tx) {
    await this.getDb(tx).execute(
      [
        'INSERT INTO player_daily_progress',
        '(id, player_id, business_date, turnover_points, unlocked_stage)',
        'VALUES (?, ?, ?, ?, ?)',
        'ON DUPLICATE KEY UPDATE',
        'turnover_points = GREATEST(turnover_points, VALUES(turnover_points)),',
        'unlocked_stage = GREATEST(unlocked_stage, VALUES(unlocked_stage))'
      ].join(' '),
      [ids.pseudoUuid(), playerId, businessDate, turnoverPoints, unlockedStage]
    );

    return this.findByPlayerAndDate(playerId, businessDate, tx);
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

  /**
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {import('../db').DatabaseConnection}
   */
  getDb(tx) {
    return tx || this.db;
  }
}

module.exports = PlayerDailyProgressRepository;
