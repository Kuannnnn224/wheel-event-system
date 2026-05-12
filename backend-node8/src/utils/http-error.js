'use strict';

/**
 * Error type consumed by the shared Express error middleware.
 */
class HttpError extends Error {
  /**
   * @param {number} statusCode
   * @param {string|string[]} message
   */
  constructor(statusCode, message) {
    const responseMessage = Array.isArray(message) ? message.join(', ') : message;
    super(responseMessage);

    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.messages = Array.isArray(message) ? message : null;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HttpError);
    }
  }

  /**
   * @param {string|string[]} message
   * @returns {HttpError}
   */
  static badRequest(message) {
    return new HttpError(400, message);
  }

  /**
   * @param {string} message
   * @returns {HttpError}
   */
  static unauthorized(message) {
    return new HttpError(401, message);
  }
}

module.exports = HttpError;
