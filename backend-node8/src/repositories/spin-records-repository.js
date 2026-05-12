'use strict';

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
 * Raw SQL repository for `spin_records`.
 */
class SpinRecordsRepository {
  /**
   * @param {import('../db').DatabaseConnection} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * @param {string} playerId
   * @param {string} businessDate
   * @returns {Promise<SpinRecord[]>}
   */
  async findByPlayerAndDate(playerId, businessDate) {
    const rows = await this.db.query(
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
}

module.exports = SpinRecordsRepository;
