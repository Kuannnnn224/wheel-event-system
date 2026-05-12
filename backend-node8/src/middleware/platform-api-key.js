'use strict';

function requirePlatformApiKey(config) {
  return function (req, res, next) {
    const expected = config.platformApiKey;
    const actual = req.headers['x-platform-api-key'];

    if (!expected || actual !== expected) {
      return res.status(401).json({ message: 'Invalid platform API key.' });
    }

    next();
  };
}

module.exports = requirePlatformApiKey;
