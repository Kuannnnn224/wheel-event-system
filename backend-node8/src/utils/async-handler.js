'use strict';

/**
 * @callback AsyncExpressHandler
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @returns {Promise<void>|void}
 */

/**
 * Converts async controller methods into Express 4 middleware.
 */
class AsyncHandler {
  /**
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
