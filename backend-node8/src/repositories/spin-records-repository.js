'use strict';

const ids = require('../utils/ids');
const time = require('../utils/time');

/**
 * @typedef {Object} SpinRecord
 * @property {string} id
 * @property {string} playerId
 * @property {string} businessDate
 * @property {number} stageNumber
 * @property {number|null} prizeConfigId
 * @property {string} prizeName
 * @property {number} amountPoints
 * @property {number} createdAt
 * @property {string} probabilityTable
 */

/**
 * @typedef {Object} SpinRecordRow
 * @property {string} id
 * @property {string} player_id
 * @property {string} business_date
 * @property {number} stage_number
 * @property {number|null} prize_config_id
 * @property {string} prize_name
 * @property {number} amount_points
 * @property {number} created_at
 * @property {string} probability_table
 */

/**
 * `spin_records` 的 raw SQL repository。
 */
class SpinRecordsRepository {
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
   * @returns {Promise<SpinRecord[]>}
   */
  async findByPlayerAndDate(playerId, businessDate, tx) {
    const rows = await this.getDb(tx).query(
      [
        'SELECT id, player_id, business_date, stage_number, prize_config_id,',
        'prize_name, amount_points, created_at, probability_table',
        'FROM spin_records',
        'WHERE player_id = ? AND business_date = ?',
        'ORDER BY stage_number ASC'
      ].join(' '),
      [playerId, businessDate]
    );

    return rows.map(this.mapRow);
  }

  /**
   * 從資料庫查詢符合條件的資料。
   *
   * @param {string} playerId
   * @param {string} businessDate
   * @param {number[]} stageNumbers
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<SpinRecord[]>}
   */
  async findByPlayerDateAndStages(playerId, businessDate, stageNumbers, tx) {
    if (!stageNumbers.length) {
      return [];
    }

    const placeholders = stageNumbers.map(function () {
      return '?';
    }).join(', ');
    const rows = await this.getDb(tx).query(
      [
        'SELECT id, player_id, business_date, stage_number, prize_config_id,',
        'prize_name, amount_points, created_at, probability_table',
        'FROM spin_records',
        'WHERE player_id = ? AND business_date = ? AND stage_number IN (' + placeholders + ')',
        'ORDER BY stage_number ASC'
      ].join(' '),
      [playerId, businessDate].concat(stageNumbers)
    );

    return rows.map(this.mapRow);
  }

  /**
   * 從資料庫彙總指定條件的數值。
   *
   * @param {string} businessDate
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<number>}
   */
  async sumAmountPointsByDate(businessDate, tx) {
    const row = await this.getDb(tx).maybeOne(
      [
        'SELECT COALESCE(SUM(amount_points), 0) AS total_amount_points',
        'FROM spin_records',
        'WHERE business_date = ?'
      ].join(' '),
      [businessDate]
    );

    return row ? Number(row.total_amount_points) : 0;
  }

  /**
   * 寫入資料庫並回傳建立後的資料物件。
   *
   * @param {Object} input
   * @param {string} input.playerId
   * @param {string} input.businessDate
   * @param {number} input.stageNumber
   * @param {string|null} [input.prizeConfigId]
   * @param {string} input.prizeName
   * @param {number} input.amountPoints
   * @param {string} input.probabilityTable
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<SpinRecord>}
   */
  async create(input, tx) {
    const spin = {
      id: ids.pseudoUuid(),
      playerId: input.playerId,
      businessDate: input.businessDate,
      stageNumber: input.stageNumber,
      prizeConfigId: input.prizeConfigId || null,
      prizeName: input.prizeName,
      amountPoints: input.amountPoints,
      createdAt: time.unixTimestampSeconds(),
      probabilityTable: input.probabilityTable
    };

    await this.getDb(tx).execute(
      [
        'INSERT INTO spin_records',
        '(id, player_id, business_date, stage_number, prize_config_id, prize_name, amount_points, created_at, probability_table)',
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ].join(' '),
      [
        spin.id,
        spin.playerId,
        spin.businessDate,
        spin.stageNumber,
        spin.prizeConfigId,
        spin.prizeName,
        spin.amountPoints,
        spin.createdAt,
        spin.probabilityTable
      ]
    );

    return spin;
  }

  /**
   * 將資料庫 row 轉成程式內使用的 camelCase 物件。
   *
   * @param {SpinRecordRow} row
   * @returns {SpinRecord}
   */
  mapRow(row) {
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
   * 依是否傳入 transaction connection 決定要用哪個 DB 連線。
   *
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {import('../db').DatabaseConnection}
   */
  getDb(tx) {
    return tx || this.db;
  }
}

module.exports = SpinRecordsRepository;
