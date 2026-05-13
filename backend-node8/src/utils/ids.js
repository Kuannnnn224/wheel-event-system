'use strict';

const crypto = require('crypto');

/**
 * 產生指定 byte 數的隨機 hex 字串。
 *
 * @param {number} bytes
 * @returns {string}
 */
function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * 產生 webview session 或下載連結使用的隨機 token。
 *
 * @returns {string}
 */
function randomToken() {
  return randomHex(32);
}

/**
 * 產生近似 UUID 格式的隨機 ID。
 *
 * @returns {string}
 */
function pseudoUuid() {
  const hex = randomHex(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-');
}

module.exports = {
  randomHex: randomHex,
  randomToken: randomToken,
  pseudoUuid: pseudoUuid
};
