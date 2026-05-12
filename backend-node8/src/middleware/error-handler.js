'use strict';

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error.';

  if (statusCode >= 500) {
    console.error(err && err.stack ? err.stack : err);
  }

  res.status(statusCode).json({
    message: message
  });
}

module.exports = errorHandler;
