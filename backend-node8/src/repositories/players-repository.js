'use strict';

const time = require('../utils/time');

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} PlayerRow
 * @property {string} id
 * @property {number} created_at
 * @property {number} updated_at
 */

/**
 * `players` 的 raw SQL repository。
 */
class PlayersRepository {
  /**
   * 初始化 repository，保存 DB 連線。
   *
   * @param {import('../db').DatabaseConnection} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * 從資料庫列出符合篩選條件的資料。
   *
   * @param {number} limit
   * @returns {Promise<Player[]>}
   */
  async listPlayers(limit, tx) {
    const rows = await this.getDb(tx).query(
      [
        'SELECT id, created_at, updated_at',
        'FROM players',
        'ORDER BY created_at DESC',
        'LIMIT ?'
      ].join(' '),
      [limit]
    );

    return rows.map(this.mapRow);
  }

  /**
   * 從資料庫查詢符合條件的資料。
   *
   * @param {string} id
   * @returns {Promise<Player|null>}
   */
  async findById(id, tx) {
    const row = await this.getDb(tx).maybeOne(
      [
        'SELECT id, created_at, updated_at',
        'FROM players',
        'WHERE id = ?',
        'LIMIT 1'
      ].join(' '),
      [id]
    );

    return this.mapRow(row);
  }

  /**
   * 寫入資料庫並回傳建立後的資料物件。
   *
   * @param {string} playerId
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Player>}
   */
  async create(playerId, tx) {
    const now = time.unixTimestampSeconds();
    const player = {
      id: playerId,
      createdAt: now,
      updatedAt: now
    };

    await this.getDb(tx).execute(
      [
        'INSERT INTO players',
        '(id, created_at, updated_at)',
        'VALUES (?, ?, ?)'
      ].join(' '),
      [player.id, player.createdAt, player.updatedAt]
    );

    return player;
  }

  /**
   * 取得指定條件下的資料。
   *
   * @param {string} playerId
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Player>}
   */
  async getOrCreateByPlayerId(playerId, tx) {
    const existing = await this.findById(playerId, tx);
    if (existing) {
      return existing;
    }

    try {
      return await this.create(playerId, tx);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return this.findById(playerId, tx);
      }

      throw err;
    }
  }

  /**
   * 將資料庫 row 轉成程式內使用的 camelCase 物件。
   *
   * @param {PlayerRow|null} row
   * @returns {Player|null}
   */
  mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
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

module.exports = PlayersRepository;
