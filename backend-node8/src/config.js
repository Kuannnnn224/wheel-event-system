'use strict';

const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

function readString(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }

  return String(value).trim();
}

function readNumber(name, fallback) {
  const raw = readString(name, '');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readList(name) {
  const raw = readString(name, '');
  if (!raw) {
    return [];
  }

  return raw.split(',').map(function (item) {
    return item.trim();
  }).filter(Boolean);
}

function resolvePath(value) {
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

const config = {
  nodeEnv: readString('NODE_ENV', 'development'),
  port: readNumber('PORT', 3001),
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
