'use strict';

const mysql = require('mysql2');
const config = require('./config');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  connectionLimit: config.db.connectionLimit,
  timezone: 'Z'
});

function query(sql, params, callback) {
  return pool.query(sql, params || [], callback);
}

function getConnection(callback) {
  return pool.getConnection(callback);
}

function withTransaction(work, callback) {
  getConnection(function (connectionError, connection) {
    if (connectionError) {
      return callback(connectionError);
    }

    connection.beginTransaction(function (beginError) {
      if (beginError) {
        connection.release();
        return callback(beginError);
      }

      work(connection, function (workError, result) {
        if (workError) {
          return connection.rollback(function () {
            connection.release();
            callback(workError);
          });
        }

        connection.commit(function (commitError) {
          connection.release();
          callback(commitError, result);
        });
      });
    });
  });
}

module.exports = {
  pool: pool,
  query: query,
  getConnection: getConnection,
  withTransaction: withTransaction
};
