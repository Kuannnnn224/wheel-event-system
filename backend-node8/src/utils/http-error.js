'use strict';

/**
 * 共用 Express 錯誤中間件會辨識的 HTTP 錯誤型別。
 */
class HttpError extends Error {
  /**
   * 建立 HTTP 錯誤物件，整理單筆或多筆錯誤訊息。
   *
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
   * 建立 400 Bad Request 錯誤，通常用於輸入驗證失敗。
   *
   * @param {string|string[]} message
   * @returns {HttpError}
   */
  static badRequest(message) {
    return new HttpError(400, message);
  }

  /**
   * 建立 401 Unauthorized 錯誤，通常用於登入或 token 驗證失敗。
   *
   * @param {string} message
   * @returns {HttpError}
   */
  static unauthorized(message) {
    return new HttpError(401, message);
  }

  /**
   * 建立 404 Not Found 錯誤，通常用於查無資料。
   *
   * @param {string} message
   * @returns {HttpError}
   */
  static notFound(message) {
    return new HttpError(404, message);
  }
}

module.exports = HttpError;
