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
 * Promise-based query wrapper shared by the pool and transaction connections.
 */
class DatabaseConnection {
  /**
   * @param {{ query: Function, execute: Function }} connection
   */
  constructor(connection) {
    this.connection = connection;
  }

  /**
   * @param {string} sql
   * @param {Array<*>} [params]
   * @returns {Promise<Array<Object>>}
   */
  async query(sql, params) {
    const result = await this.connection.query(sql, params || []);
    return result[0];
  }

  /**
   * @param {string} sql
   * @param {Array<*>} [params]
   * @returns {Promise<*>}
   */
  async execute(sql, params) {
    const result = await this.connection.execute(sql, params || []);
    return result[0];
  }

  /**
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
 * Root database pool with transaction support.
 */
class Database extends DatabaseConnection {
  /**
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
   * @returns {Promise<void>}
   */
  async close() {
    await this.pool.end();
  }
}

module.exports = new Database(config.db);
module.exports.Database = Database;
module.exports.DatabaseConnection = DatabaseConnection;
