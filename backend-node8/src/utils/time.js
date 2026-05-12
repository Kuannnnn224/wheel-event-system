'use strict';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function unixTimestampSeconds(date) {
  const value = date || new Date();
  return Math.floor(value.getTime() / 1000);
}

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

function assertBusinessDate(value) {
  if (!DATE_PATTERN.test(value)) {
    const err = new Error('Business date must use YYYY-MM-DD');
    err.statusCode = 400;
    throw err;
  }

  return value;
}

module.exports = {
  unixTimestampSeconds: unixTimestampSeconds,
  getBusinessDate: getBusinessDate,
  assertBusinessDate: assertBusinessDate
};
