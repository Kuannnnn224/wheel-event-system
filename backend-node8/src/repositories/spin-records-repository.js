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
        'SELECT id, playerId, businessDate, stageNumber, prizeConfigId,',
        'prizeName, amountPoints, createdAt, probabilityTable',
        'FROM spin_records',
        'WHERE playerId = ? AND businessDate = ?',
        'ORDER BY stageNumber ASC'
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
        'SELECT id, playerId, businessDate, stageNumber, prizeConfigId,',
        'prizeName, amountPoints, createdAt, probabilityTable',
        'FROM spin_records',
        'WHERE playerId = ? AND businessDate = ? AND stageNumber IN (' + placeholders + ')',
        'ORDER BY stageNumber ASC'
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
        'SELECT COALESCE(SUM(amountPoints), 0) AS totalAmountPoints',
        'FROM spin_records',
        'WHERE businessDate = ?'
      ].join(' '),
      [businessDate]
    );

    return row ? Number(row.totalAmountPoints) : 0;
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
        '(id, playerId, businessDate, stageNumber, prizeConfigId, prizeName, amountPoints, createdAt, probabilityTable)',
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
