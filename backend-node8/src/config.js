'use strict';

const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

/**
 * 讀取字串型環境變數，空值時回傳預設值。
 *
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function readString(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }

  return String(value).trim();
}

/**
 * 讀取數字型環境變數，無法解析時回傳預設值。
 *
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function readNumber(name, fallback) {
  const raw = readString(name, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * 讀取 port 設定，避免 0 或負數造成隨機監聽埠。
 *
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function readPort(name, fallback) {
  const parsed = readNumber(name, fallback);
  return parsed > 0 ? parsed : fallback;
}

/**
 * 讀取逗號分隔的環境變數清單。
 *
 * @param {string} name
 * @returns {string[]}
 */
function readList(name) {
  const raw = readString(name, '');
  if (!raw) {
    return [];
  }

  return raw.split(',').map(function (item) {
    return item.trim();
  }).filter(Boolean);
}

/**
 * 將相對路徑轉成以 backend-node8 為基準的絕對路徑。
 *
 * @param {string} value
 * @returns {string}
 */
function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

const config = {
  nodeEnv: readString('NODE_ENV', 'development'),
  port: readPort('PORT', 3001),
  host: readString('HOST', '0.0.0.0'),
  corsOrigins: readList('CORS_ORIGIN'),

  db: {
    host: readString('DB_HOST', 'localhost'),
    port: readNumber('DB_PORT', 3306),
    user: readString('DB_USERNAME', 'wheel_app'),
    password: readString('DB_PASSWORD', 'wheel_password'),
    database: readString('DB_DATABASE', 'wheel_event'),
    connectionLimit: readNumber('DB_CONNECTION_LIMIT', 10)
  },

  businessTimeZone: readString('BUSINESS_TIME_ZONE', ''),
  jwtSecret: readString('JWT_SECRET', 'change-this-secret'),
  jwtExpiresIn: readString('JWT_EXPIRES_IN', '8h'),
  adminUsername: readString('ADMIN_USERNAME', 'admin'),
  adminPassword: readString('ADMIN_PASSWORD', 'admin123'),
  platformApiKey: readString('PLATFORM_API_KEY', ''),

  webviewBaseUrl: readString('WEBVIEW_BASE_URL', ''),
  webviewApiBaseUrl: readString('WEBVIEW_API_BASE_URL', '/api'),
  demoTokenTtlMinutes: readNumber('DEMO_TOKEN_TTL_MINUTES', 30),
  probabilityConfigPath: resolvePath(readString('PROBABILITY_CONFIG_PATH', 'config/probability.json')),
  probabilityImportStoragePath: resolvePath(readString('PROBABILITY_IMPORT_STORAGE_PATH', 'storage/probability-imports')),
  frontendDistPath: resolvePath(readString('FRONTEND_DIST_PATH', 'public')),
  webviewPublicPath: resolvePath(readString('WEBVIEW_PUBLIC_PATH', 'public'))
};

module.exports = config;
