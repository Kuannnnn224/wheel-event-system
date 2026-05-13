'use strict';

/**
 * @callback AsyncExpressHandler
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {Promise<void>|void}
 */

/**
 * 將 async controller method 包成 Express 4 可接收的 middleware。
 */
class AsyncHandler {
  /**
   * 包裝 async handler，讓 throw/reject 交給 Express error middleware。
   *
   * @param {AsyncExpressHandler} handler
   * @returns {Function}
   */
  static wrap(handler) {
    return function (req, res, next) {
      try {
        Promise.resolve(handler(req, res, next)).catch(next);
      } catch (err) {
        next(err);
      }
    };
  }
}

module.exports = AsyncHandler;
