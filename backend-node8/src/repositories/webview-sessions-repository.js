'use strict';

const ids = require('../utils/ids');
const time = require('../utils/time');

/**
 * @typedef {Object} WebviewSession
 * @property {string} id
 * @property {string} playerId
 * @property {string} token
 * @property {number} expiresAt
 * @property {number} createdAt
 * @property {Object|null} [player]
 */

/**
 * @typedef {Object} WebviewSessionRow
 * @property {string} id
 * @property {string} player_id
 * @property {string} token
 * @property {number} expires_at
 * @property {number} created_at
 * @property {string|null} player_external_id
 * @property {number|null} player_created_at
 * @property {number|null} player_updated_at
 */

/**
 * 短效 webview session 的 raw SQL repository。
 */
class WebviewSessionsRepository {
  /**
   * 初始化 repository，保存 DB 連線。
   *
   * @param {import('../db').DatabaseConnection} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * 用 transaction connection 建立同型 repository。
   *
   * @param {import('../db').DatabaseConnection} db
   * @returns {WebviewSessionsRepository}
   */
  withConnection(db) {
    return new WebviewSessionsRepository(db);
  }

  /**
   * 寫入資料庫並回傳建立後的資料物件。
   *
   * @param {{ playerId: string, token: string, expiresAt: number }} input
   * @returns {Promise<WebviewSession>}
   */
  async create(input) {
    const session = {
      id: ids.pseudoUuid(),
      playerId: input.playerId,
      token: input.token,
      expiresAt: input.expiresAt,
      createdAt: time.unixTimestampSeconds()
    };

    await this.db.execute(
      [
        'INSERT INTO webview_sessions',
        '(id, player_id, token, expires_at, created_at)',
        'VALUES (?, ?, ?, ?, ?)'
      ].join(' '),
      [session.id, session.playerId, session.token, session.expiresAt, session.createdAt]
    );

    return session;
  }

  /**
   * 從資料庫查詢符合 token 的 webview session。
   *
   * @param {string} token
   * @returns {Promise<WebviewSession|null>}
   */
  async findByToken(token) {
    const row = await this.db.maybeOne(
      [
        'SELECT ws.id, ws.player_id, ws.token, ws.expires_at, ws.created_at,',
        'p.external_id AS player_external_id,',
        'p.created_at AS player_created_at,',
        'p.updated_at AS player_updated_at',
        'FROM webview_sessions ws',
        'INNER JOIN players p ON p.id = ws.player_id',
        'WHERE ws.token = ?',
        'LIMIT 1'
      ].join(' '),
      [token]
    );

    return this.mapRow(row);
  }

  /**
   * 將資料庫 row 轉成程式內使用的 camelCase 物件。
   *
   * @param {WebviewSessionRow|null} row
   * @returns {WebviewSession|null}
   */
  mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      playerId: row.player_id,
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      player: {
        id: row.player_id,
        externalId: row.player_external_id,
        createdAt: row.player_created_at,
        updatedAt: row.player_updated_at
      }
    };
  }
}

module.exports = WebviewSessionsRepository;
