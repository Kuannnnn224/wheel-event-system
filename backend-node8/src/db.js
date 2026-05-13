'use strict';

const mysql = require('mysql2/promise');
const config = require('./config');

/**
 * @typedef {Object} DbConfig
 * @property {string} host
 * @property {number} port
 * @property {string} user
 * @property {string} password
 * @property {string} database
 * @property {number} connectionLimit
 */

/**
 * pool 與 transaction connection 共用的 Promise 查詢包裝器。
 */
class DatabaseConnection {
  /**
   * 初始化資料庫連線包裝器。
   *
   * @param {{ query: Function, execute: Function }} connection
   */
  constructor(connection) {
    this.connection = connection;
  }

  /**
   * 執行 SQL query 並回傳 rows。
   *
   * @param {string} sql
   * @param {Array<*>} [params]
   * @returns {Promise<Array<Object>>}
   */
  async query(sql, params) {
    const result = await this.connection.query(sql, params || []);
    return result[0];
  }

  /**
   * 執行 SQL execute，常用於 insert/update/delete。
   *
   * @param {string} sql
   * @param {Array<*>} [params]
   * @returns {Promise<*>}
   */
  async execute(sql, params) {
    const result = await this.connection.execute(sql, params || []);
    return result[0];
  }

  /**
   * 執行查詢並回傳第一筆資料，沒有資料時回傳 null。
   *
   * @param {string} sql
   * @param {Array<*>} [params]
   * @returns {Promise<Object|null>}
   */
  async maybeOne(sql, params) {
    const rows = await this.query(sql, params);
    return rows.length ? rows[0] : null;
  }
}

/**
 * 根層資料庫 pool，提供 transaction 支援。
 */
class Database extends DatabaseConnection {
  /**
   * 初始化資料庫 pool，並沿用同一套 query helper。
   *
   * @param {DbConfig} dbConfig
   */
  constructor(dbConfig) {
    const pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      connectionLimit: dbConfig.connectionLimit,
      timezone: 'Z'
    });

    super(pool);
    this.pool = pool;
  }

  /**
   * 建立交易連線，成功 commit、失敗 rollback。
   *
   * @template T
   * @param {(tx: DatabaseConnection) => Promise<T>} work
   * @returns {Promise<T>}
   */
  async withTransaction(work) {
    const connection = await this.pool.getConnection();
    const tx = new DatabaseConnection(connection);

    try {
      await connection.beginTransaction();
      const result = await work(tx);
      await connection.commit();
      return result;
    } catch (err) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        err.rollbackError = rollbackErr;
      }

      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * 關閉 MySQL connection pool。
   *
   * @returns {Promise<void>}
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = new Database(config.db);
module.exports.Database = Database;
module.exports.DatabaseConnection = DatabaseConnection;
