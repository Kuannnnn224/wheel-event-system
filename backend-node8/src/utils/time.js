'use strict';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 取得 Unix timestamp 秒數，用於 DB int 時間欄位。
 *
 * @param {Date} [date]
 * @returns {number}
 */
function unixTimestampSeconds(date) {
  const value = date || new Date();
  return Math.floor(value.getTime() / 1000);
}

/**
 * 依業務時區計算 YYYY-MM-DD 業務日期。
 *
 * @param {Date|null} [date]
 * @param {string} [timeZone]
 * @returns {string}
 */
function getBusinessDate(date, timeZone) {
  const value = date || new Date();
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };

  if (timeZone) {
    options.timeZone = timeZone;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', options);
  if (typeof formatter.formatToParts === 'function') {
    const parts = formatter.formatToParts(value);
    const values = {};
    parts.forEach(function (part) {
      values[part.type] = part.value;
    });
    return values.year + '-' + values.month + '-' + values.day;
  }

  return formatter.format(value);
}

/**
 * 確認日期字串符合 YYYY-MM-DD 格式。
 *
 * @param {string} value
 * @returns {string}
 */
function assertBusinessDate(value) {
  if (!DATE_PATTERN.test(value)) {
    const err = new Error('Business date must use YYYY-MM-DD');
    err.statusCode = 400;
    throw err;
  }

  return value;
}

/**
 * 解析傳入日期，未提供時使用目前業務日期。
 *
 * @param {string|undefined} value
 * @param {string} [timeZone]
 * @returns {string}
 */
function resolveBusinessDate(value, timeZone) {
  return value ? assertBusinessDate(value) : getBusinessDate(null, timeZone);
}

/**
 * 解析並限制只能使用今天的業務日期。
 *
 * @param {string|undefined} value
 * @param {string} [timeZone]
 * @returns {string}
 */
function resolveCurrentBusinessDate(value, timeZone) {
  const businessDate = resolveBusinessDate(value, timeZone);
  const currentBusinessDate = getBusinessDate(null, timeZone);

  if (businessDate !== currentBusinessDate) {
    const err = new Error('Only current business date ' + currentBusinessDate + ' is allowed.');
    err.statusCode = 400;
    throw err;
  }

  return businessDate;
}

module.exports = {
  unixTimestampSeconds: unixTimestampSeconds,
  getBusinessDate: getBusinessDate,
  assertBusinessDate: assertBusinessDate,
  resolveBusinessDate: resolveBusinessDate,
  resolveCurrentBusinessDate: resolveCurrentBusinessDate
};
