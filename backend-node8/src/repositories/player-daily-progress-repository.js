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
 * @property {string} playerId
 * @property {string} businessDate
 * @property {number} turnoverPoints
 * @property {number} unlockedStage
 */

/**
 * `player_daily_progress` 的 raw SQL repository。
 */
class PlayerDailyProgressRepository {
  /**
   * 初始化 repository，保存 DB 連線。
   *
   * @param {import('../db').DatabaseConnection} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * 從資料庫查詢符合條件的資料。
   *
   * @param {string} playerId
   * @param {string} businessDate
   * @returns {Promise<PlayerDailyProgress|null>}
   */
  async findByPlayerAndDate(playerId, businessDate, tx) {
    const row = await this.getDb(tx).maybeOne(
      [
        'SELECT id, playerId, businessDate, turnoverPoints, unlockedStage',
        'FROM player_daily_progress',
        'WHERE playerId = ? AND businessDate = ?',
        'LIMIT 1'
      ].join(' '),
      [playerId, businessDate]
    );

    return this.mapRow(row);
  }

  /**
   * 寫入或提高目前進度，不會把既有進度往下調。
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
        '(id, playerId, businessDate, turnoverPoints, unlockedStage)',
        'VALUES (?, ?, ?, ?, ?)',
        'ON DUPLICATE KEY UPDATE',
        'turnoverPoints = GREATEST(turnoverPoints, VALUES(turnoverPoints)),',
        'unlockedStage = GREATEST(unlockedStage, VALUES(unlockedStage))'
      ].join(' '),
      [ids.pseudoUuid(), playerId, businessDate, turnoverPoints, unlockedStage]
    );

    return this.findByPlayerAndDate(playerId, businessDate, tx);
  }

  /**
   * 將資料庫 row 轉成程式內使用的 camelCase 物件。
   *
   * @param {PlayerDailyProgressRow|null} row
   * @returns {PlayerDailyProgress|null}
   */
  mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      playerId: row.playerId,
      businessDate: row.businessDate,
      turnoverPoints: row.turnoverPoints,
      unlockedStage: row.unlockedStage
    };
  }

  /**
   * 依是否傳入 transaction connection 決定要用哪個 DB 連線。
   *
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {import('../db').DatabaseConnection}
   */
  getDb(tx) {
    return tx || this.db;
  }
}

module.exports = PlayerDailyProgressRepository;
