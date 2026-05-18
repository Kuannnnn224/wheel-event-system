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
 * @property {string} passwordHash
 * @property {number} isActive
 * @property {number} createdAt
 * @property {number} updatedAt
 */

/**
 * `admin_users` 的 raw SQL repository。
 */
class AdminUsersRepository {
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
   * @param {string} username
   * @returns {Promise<AdminUser|null>}
   */
  async findByUsername(username) {
    const row = await this.db.maybeOne(
      [
        'SELECT id, username, passwordHash, isActive, createdAt, updatedAt',
        'FROM admin_users',
        'WHERE username = ?',
        'LIMIT 1'
      ].join(' '),
      [username]
    );

    return this.mapRow(row);
  }

  /**
   * 從資料庫查詢符合條件的資料。
   *
   * @param {string} username
   * @returns {Promise<AdminUser|null>}
   */
  async findActiveByUsername(username) {
    const row = await this.db.maybeOne(
      [
        'SELECT id, username, passwordHash, isActive, createdAt, updatedAt',
        'FROM admin_users',
        'WHERE username = ? AND isActive = 1',
        'LIMIT 1'
      ].join(' '),
      [username]
    );

    return this.mapRow(row);
  }

  /**
   * 寫入資料庫並回傳建立後的資料物件。
   *
   * @param {AdminUser} admin
   * @returns {Promise<AdminUser>}
   */
  async create(admin) {
    await this.db.execute(
      [
        'INSERT INTO admin_users',
        '(id, username, passwordHash, isActive, createdAt, updatedAt)',
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
   * 將資料庫 row 轉成程式內使用的 camelCase 物件。
   *
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
      passwordHash: row.passwordHash,
      isActive: !!row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}

module.exports = AdminUsersRepository;
