'use strict';

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
  async listPlayers(limit) {
    const rows = await this.db.query(
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
  async findById(id) {
    const row = await this.db.maybeOne(
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
  async findByExternalId(externalId) {
    const row = await this.db.maybeOne(
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
}

module.exports = PlayersRepository;
