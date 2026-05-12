'use strict';

const crypto = require('crypto');

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

function randomToken() {
  return randomHex(32);
}

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
