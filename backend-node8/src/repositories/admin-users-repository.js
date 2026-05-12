'use strict';

/**
 * @typedef {Object} AdminUser
 * @property {string} id
 * @property {string} username
 * @property {string} passwordHash
 * @property {boolean} isActive
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * @typedef {Object} AdminUserRow
 * @property {string} id
 * @property {string} username
 * @property {string} password_hash
 * @property {number} is_active
 * @property {number} created_at
 * @property {number} updated_at
 */

/**
 * Raw SQL repository for `admin_users`.
 */
class AdminUsersRepository {
  /**
   * @param {import('../db').DatabaseConnection} db
   */
  constructor(db) {
    this.db = db;
  }

  /**
   * @param {string} username
   * @returns {Promise<AdminUser|null>}
   */
  async findByUsername(username) {
    const row = await this.db.maybeOne(
      [
        'SELECT id, username, password_hash, is_active, created_at, updated_at',
        'FROM admin_users',
        'WHERE username = ?',
        'LIMIT 1'
      ].join(' '),
      [username]
    );

    return this.mapRow(row);
  }

  /**
   * @param {string} username
   * @returns {Promise<AdminUser|null>}
   */
  async findActiveByUsername(username) {
    const row = await this.db.maybeOne(
      [
        'SELECT id, username, password_hash, is_active, created_at, updated_at',
        'FROM admin_users',
        'WHERE username = ? AND is_active = 1',
        'LIMIT 1'
      ].join(' '),
      [username]
    );

    return this.mapRow(row);
  }

  /**
   * @param {AdminUser} admin
   * @returns {Promise<AdminUser>}
   */
  async create(admin) {
    await this.db.execute(
      [
        'INSERT INTO admin_users',
        '(id, username, password_hash, is_active, created_at, updated_at)',
        'VALUES (?, ?, ?, ?, ?, ?)'
      ].join(' '),
      [
        admin.id,
        admin.username,
        admin.passwordHash,
        admin.isActive ? 1 : 0,
        admin.createdAt,
        admin.updatedAt
      ]
    );

    return admin;
  }

  /**
   * @param {AdminUserRow|null} row
   * @returns {AdminUser|null}
   */
  mapRow(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      isActive: !!row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = AdminUsersRepository;
