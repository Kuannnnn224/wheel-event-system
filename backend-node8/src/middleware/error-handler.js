'use strict';

/**
 * 統一 Express 錯誤回應格式，並在 5xx 時輸出 log。
 *
 * @param {Error & { status?: number, statusCode?: number, messages?: string[] }} err
 * @param {Object} _req
 * @param {Object} res
 * @param {Function} _next
 * @returns {void}
 */
function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || err.status || (err.name === 'MulterError' ? 400 : 500);
  const message = err.message || 'Internal server error.';
  const payload = {
    message: err.messages || message
  };

  if (statusCode >= 500) {
    console.error(err && err.stack ? err.stack : err);
  }

  res.status(statusCode).json(payload);
}

module.exports = errorHandler;
