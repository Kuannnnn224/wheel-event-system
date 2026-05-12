'use strict';

const ids = require('../utils/ids');
const time = require('../utils/time');

/**
 * @typedef {Object} DemoSession
 * @property {string} id
 * @property {string} playerId
 * @property {string} token
 * @property {number} expiresAt
 * @property {number} createdAt
 * @property {Object|null} [player]
 */

/**
 * @typedef {Object} DemoSessionRow
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
 * Raw SQL repository for short-lived demo webview sessions.
 */
class DemoSessionsRepository {
  /**
   * @param {import('../db').DatabaseConnection} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * Creates the same repository type against a transaction connection.
   *
   * @param {import('../db').DatabaseConnection} db
   * @returns {DemoSessionsRepository}
   */
  withConnection(db) {
    return new DemoSessionsRepository(db);
  }

  /**
   * @param {{ playerId: string, token: string, expiresAt: number }} input
   * @returns {Promise<DemoSession>}
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
        'INSERT INTO demo_sessions',
        '(id, player_id, token, expires_at, created_at)',
        'VALUES (?, ?, ?, ?, ?)'
      ].join(' '),
      [session.id, session.playerId, session.token, session.expiresAt, session.createdAt]
    );

    return session;
  }

  /**
   * @param {string} token
   * @returns {Promise<DemoSession|null>}
   */
  async findByToken(token) {
    const row = await this.db.maybeOne(
      [
        'SELECT ds.id, ds.player_id, ds.token, ds.expires_at, ds.created_at,',
        'p.external_id AS player_external_id,',
        'p.created_at AS player_created_at,',
        'p.updated_at AS player_updated_at',
        'FROM demo_sessions ds',
        'INNER JOIN players p ON p.id = ds.player_id',
        'WHERE ds.token = ?',
        'LIMIT 1'
      ].join(' '),
      [token]
    );

    return this.mapRow(row);
  }

  /**
   * @param {DemoSessionRow|null} row
   * @returns {DemoSession|null}
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

module.exports = DemoSessionsRepository;
