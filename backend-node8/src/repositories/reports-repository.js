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
        'SELECT id, playerId, businessDate, stageNumber, prizeConfigId, prizeName, amountPoints, createdAt, probabilityTable',
        'FROM spin_records',
        'WHERE businessDate BETWEEN ? AND ?',
        'ORDER BY businessDate ASC, stageNumber ASC'
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
        'SELECT id, playerId, businessDate, stageNumber, prizeConfigId, prizeName, amountPoints, createdAt, probabilityTable',
        'FROM spin_records',
        'WHERE playerId = ? AND businessDate BETWEEN ? AND ?',
        'ORDER BY businessDate ASC, stageNumber ASC'
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
        'SELECT id, playerId, businessDate, turnoverPoints, unlockedStage',
        'FROM player_daily_progress',
        'WHERE playerId = ? AND businessDate BETWEEN ? AND ?',
        'ORDER BY businessDate ASC'
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
    playerId: row.playerId,
    businessDate: row.businessDate,
    stageNumber: row.stageNumber,
    prizeConfigId: row.prizeConfigId,
    prizeName: row.prizeName,
    amountPoints: row.amountPoints,
    createdAt: row.createdAt,
    probabilityTable: row.probabilityTable
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
    playerId: row.playerId,
    businessDate: row.businessDate,
    turnoverPoints: row.turnoverPoints,
    unlockedStage: row.unlockedStage
  };
}

module.exports = ReportsRepository;
