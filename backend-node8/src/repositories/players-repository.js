'use strict';

const ids = require('../utils/ids');
const time = require('../utils/time');

/**
 * @typedef {Object} Player
 * @property {string} id
 * @property {string} externalId
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} PlayerRow
 * @property {string} id
 * @property {string} external_id
 * @property {number} created_at
 * @property {number} updated_at
 */

/**
 * Raw SQL repository for `players`.
 */
class PlayersRepository {
  /**
   * @param {import('../db').DatabaseConnection} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * @param {number} limit
   * @returns {Promise<Player[]>}
   */
  async listPlayers(limit, tx) {
    const rows = await this.getDb(tx).query(
      [
        'SELECT id, external_id, created_at, updated_at',
        'FROM players',
        'ORDER BY created_at DESC',
        'LIMIT ?'
      ].join(' '),
      [limit]
    );

    return rows.map(this.mapRow);
  }

  /**
   * @param {string} id
   * @returns {Promise<Player|null>}
   */
  async findById(id, tx) {
    const row = await this.getDb(tx).maybeOne(
      [
        'SELECT id, external_id, created_at, updated_at',
        'FROM players',
        'WHERE id = ?',
        'LIMIT 1'
      ].join(' '),
      [id]
    );

    return this.mapRow(row);
  }

  /**
   * @param {string} externalId
   * @returns {Promise<Player|null>}
   */
  async findByExternalId(externalId, tx) {
    const row = await this.getDb(tx).maybeOne(
      [
        'SELECT id, external_id, created_at, updated_at',
        'FROM players',
        'WHERE external_id = ?',
        'LIMIT 1'
      ].join(' '),
      [externalId]
    );

    return this.mapRow(row);
  }

  /**
   * @param {string} externalId
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Player>}
   */
  async create(externalId, tx) {
    const now = time.unixTimestampSeconds();
    const player = {
      id: ids.pseudoUuid(),
      externalId: externalId,
      createdAt: now,
      updatedAt: now
    };

    await this.getDb(tx).execute(
      [
        'INSERT INTO players',
        '(id, external_id, created_at, updated_at)',
        'VALUES (?, ?, ?, ?)'
      ].join(' '),
      [player.id, player.externalId, player.createdAt, player.updatedAt]
    );

    return player;
  }

  /**
   * @param {string} externalId
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Player>}
   */
  async getOrCreateByExternalId(externalId, tx) {
    const existing = await this.findByExternalId(externalId, tx);
    if (existing) {
      return existing;
    }

    try {
      return await this.create(externalId, tx);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return this.findByExternalId(externalId, tx);
      }

      throw err;
    }
  }

  /**
   * @param {PlayerRow|null} row
   * @returns {Player|null}
   */
  mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      externalId: row.external_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
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

module.exports = PlayersRepository;
