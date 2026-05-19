'use strict';

const jwt = require('jsonwebtoken');
const HttpError = require('../utils/http-error');
const time = require('../utils/time');

const WEBVIEW_ENDPOINT = '/webview';

/**
 * 處理正式 Webview URL token 的簽發與驗證。
 */
class WebviewTokenService {
  /**
   * 初始化 token service，保存 secret 與有效時間設定。
   *
   * @param {{ config: Object }} options
   */
  constructor(options) {
    this.config = options.config;
    this.secret = this.config.webviewTokenSecret || this.config.jwtSecret;
    this.ttlSeconds = Math.max(1, Number(this.config.webviewSessionTtlMinutes || 30)) * 60;
    this.clockSkewSeconds = Math.max(0, Number(this.config.webviewTokenClockSkewSeconds || 0));
  }

  /**
   * 將 App client 傳來的玩家狀態簽成 Webview token。
   *
   * @param {{ playerId: string, turnoverPoints: number, unlockedStage: number }} input
   * @returns {{ token: string, issuedAt: number, expiresAt: number }}
   */
  sign(input) {
    const issuedAt = time.unixTimestampSeconds();
    const payload = {
      playerId: input.playerId,
      timestamp: issuedAt,
      endpoint: WEBVIEW_ENDPOINT,
      turnoverPoints: normalizeNonNegativeInteger(input.turnoverPoints, 0),
      unlockedStage: normalizeStage(input.unlockedStage)
    };

    return {
      token: jwt.sign(payload, this.secret, { algorithm: 'HS256' }),
      issuedAt: issuedAt,
      expiresAt: issuedAt + this.ttlSeconds
    };
  }

  /**
   * 驗證 Webview token，回傳 App client 簽入的玩家狀態。
   *
   * @param {string} token
   * @returns {{ playerId: string, issuedAt: number, expiresAt: number, turnoverPoints: number, unlockedStage: number }}
   */
  verify(token) {
    const rawToken = typeof token === 'string' ? token.trim() : '';
    if (!rawToken) {
      throw HttpError.badRequest('token must be a string');
    }

    let payload = null;
    try {
      payload = jwt.verify(rawToken, this.secret);
    } catch (_err) {
      throw HttpError.unauthorized('Invalid webview token.');
    }

    return this.normalizePayload(payload);
  }

  /**
   * 將 JWT payload 轉成 runtime 可使用的格式。
   *
   * @param {Object} payload
   * @returns {{ playerId: string, issuedAt: number, expiresAt: number, turnoverPoints: number, unlockedStage: number }}
   */
  normalizePayload(payload) {
    const playerId = payload && typeof payload.playerId === 'string' ? payload.playerId.trim() : '';
    const issuedAt = normalizeTimestamp(payload ? payload.timestamp : undefined);
    const endpoint = payload && typeof payload.endpoint === 'string' ? payload.endpoint : '';

    if (!playerId || playerId.length > 120) {
      throw HttpError.unauthorized('Invalid webview token player.');
    }

    if (!issuedAt) {
      throw HttpError.unauthorized('Invalid webview token timestamp.');
    }

    if (normalizeEndpoint(endpoint) !== WEBVIEW_ENDPOINT) {
      throw HttpError.unauthorized('Invalid webview token endpoint.');
    }

    const normalized = {
      playerId: playerId,
      issuedAt: issuedAt,
      expiresAt: issuedAt + this.ttlSeconds,
      turnoverPoints: normalizeNonNegativeInteger(payload ? payload.turnoverPoints : undefined, 0),
      unlockedStage: normalizeStage(payload ? payload.unlockedStage : undefined)
    };

    this.assertTokenTime(normalized);
    return normalized;
  }

  /**
   * 檢查 token timestamp 是否仍在有效時間內。
   *
   * @param {{ issuedAt: number, expiresAt: number }} payload
   * @returns {void}
   */
  assertTokenTime(payload) {
    const now = time.unixTimestampSeconds();

    if (payload.issuedAt > now + this.clockSkewSeconds) {
      throw HttpError.unauthorized('Webview token timestamp is not valid yet.');
    }

    if (payload.expiresAt <= now - this.clockSkewSeconds) {
      throw HttpError.unauthorized('Webview token expired.');
    }
  }
}

/**
 * 正規化 endpoint 字串。
 *
 * @param {string} endpoint
 * @returns {string}
 */
function normalizeEndpoint(endpoint) {
  let value = endpoint ? String(endpoint).trim() : '';
  if (value.indexOf('/api/') === 0) {
    value = value.slice(4);
  }

  value = value.replace(/\/+$/, '');
  if (value.charAt(0) !== '/') {
    value = '/' + value;
  }

  return value || '/';
}

/**
 * 將 timestamp 欄位正規化成 Unix timestamp 秒數。
 *
 * @param {number|string|undefined} value
 * @returns {number}
 */
function normalizeTimestamp(value) {
  const timestamp = Number(value);
  if (!Number.isInteger(timestamp) || timestamp <= 0) {
    return 0;
  }

  return timestamp;
}

/**
 * 將非負整數欄位正規化，無效時回傳預設值。
 *
 * @param {number|string|undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function normalizeNonNegativeInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    return fallback;
  }

  return number;
}

/**
 * 將 unlockedStage 正規化成 0 到 5，無效時視為 token 錯誤。
 *
 * @param {number|string|null|undefined} value
 * @returns {number}
 */
function normalizeStage(value) {
  const stage = Number(value);
  if (!Number.isInteger(stage) || stage < 0 || stage > 5) {
    throw HttpError.unauthorized('Invalid webview token unlockedStage.');
  }

  return stage;
}

module.exports = WebviewTokenService;
