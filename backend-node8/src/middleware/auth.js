'use strict';

const jwt = require('jsonwebtoken');

function requireAdmin(config) {
  return function (req, res, next) {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({ message: 'Missing bearer token.' });
    }

    jwt.verify(token, config.jwtSecret, function (err, payload) {
      if (err) {
        return res.status(401).json({ message: 'Invalid bearer token.' });
      }

      req.admin = payload;
      next();
    });
  };
}

function extractBearerToken(req) {
  const authorization = req.headers.authorization || '';
  const parts = authorization.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return '';
  }

  return parts[1];
}

module.exports = {
  requireAdmin: requireAdmin,
  extractBearerToken: extractBearerToken
};
