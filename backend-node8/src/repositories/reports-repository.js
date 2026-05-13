'use strict';

/**
 * 查詢抽獎紀錄與每日進度區間的唯讀報表 repository。
 */
class ReportsRepository {
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
   * @param {string} startDate
   * @param {string} endDate
   * @returns {Promise<Object[]>}
   */
  async findSpinsBetween(startDate, endDate) {
    const rows = await this.db.query(
      [
        'SELECT id, player_id, business_date, stage_number, prize_config_id, prize_name, amount_points, created_at, probability_table',
        'FROM spin_records',
        'WHERE business_date BETWEEN ? AND ?',
        'ORDER BY business_date ASC, stage_number ASC'
      ].join(' '),
      [startDate, endDate]
    );

    return rows.map(mapSpinRow);
  }

  /**
   * 從資料庫查詢符合條件的資料。
   *
   * @param {string} playerId
   * @param {string} startDate
   * @param {string} endDate
   * @returns {Promise<Object[]>}
   */
  async findSpinsByPlayerBetween(playerId, startDate, endDate) {
    const rows = await this.db.query(
      [
        'SELECT id, player_id, business_date, stage_number, prize_config_id, prize_name, amount_points, created_at, probability_table',
        'FROM spin_records',
        'WHERE player_id = ? AND business_date BETWEEN ? AND ?',
        'ORDER BY business_date ASC, stage_number ASC'
      ].join(' '),
      [playerId, startDate, endDate]
    );

    return rows.map(mapSpinRow);
  }

  /**
   * 從資料庫查詢符合條件的資料。
   *
   * @param {string} playerId
   * @param {string} startDate
   * @param {string} endDate
   * @returns {Promise<Object[]>}
   */
  async findProgressByPlayerBetween(playerId, startDate, endDate) {
    const rows = await this.db.query(
      [
        'SELECT id, player_id, business_date, turnover_points, unlocked_stage',
        'FROM player_daily_progress',
        'WHERE player_id = ? AND business_date BETWEEN ? AND ?',
        'ORDER BY business_date ASC'
      ].join(' '),
      [playerId, startDate, endDate]
    );

    return rows.map(mapProgressRow);
  }
}

/**
 * 將 spin_records row 轉成報表 service 使用的物件。
 *
 * @param {Object} row
 * @returns {Object}
 */
function mapSpinRow(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    businessDate: row.business_date,
    stageNumber: row.stage_number,
    prizeConfigId: row.prize_config_id,
    prizeName: row.prize_name,
    amountPoints: row.amount_points,
    createdAt: row.created_at,
    probabilityTable: row.probability_table
  };
}

/**
 * 將 player_daily_progress row 轉成報表 service 使用的物件。
 *
 * @param {Object} row
 * @returns {Object}
 */
function mapProgressRow(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    businessDate: row.business_date,
    turnoverPoints: row.turnover_points,
    unlockedStage: row.unlocked_stage
  };
}

module.exports = ReportsRepository;
