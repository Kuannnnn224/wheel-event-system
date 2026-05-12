'use strict';

const AdmZip = require('adm-zip');
const XLSX = require('xlsx');

const REWARD_CODES = ['A', 'B', 'C', 'D', 'E'];
const STAGE_TEXT_PAIRS = [
  ['一', 1],
  ['二', 2],
  ['三', 3],
  ['四', 4],
  ['五', 5]
];

/**
 * Parses PM probability XLSX zip files into the runtime probability JSON shape.
 */
class ProbabilityXlsxParser {
  /**
   * @param {Buffer} zipBuffer
   * @returns {Object}
   */
  parseZip(zipBuffer) {
    const zip = new AdmZip(zipBuffer);
    const files = {};

    zip.getEntries().forEach(function (entry) {
      if (entry.isDirectory) {
        return;
      }

      const parts = entry.entryName.split(/[\\/]/);
      const fileName = parts[parts.length - 1].toLowerCase();
      if (fileName) {
        files[fileName] = entry.getData();
      }
    });

    return this.parseWorkbooks({
      configWorkbook: XLSX.read(this.requireZipEntry(files, 'config.xlsx'), { type: 'buffer' }),
      lowWorkbook: XLSX.read(this.requireZipEntry(files, 'low.xlsx'), { type: 'buffer' }),
      highWorkbook: XLSX.read(this.requireZipEntry(files, 'high.xlsx'), { type: 'buffer' }),
      prizeWorkbook: XLSX.read(this.requireZipEntry(files, 'prize.xlsx'), { type: 'buffer' }),
      dailyLimitWorkbook: XLSX.read(this.requireZipEntry(files, 'daily-limit.xlsx'), { type: 'buffer' }),
      weightWorkbook: XLSX.read(this.requireZipEntry(files, 'weight.xlsx'), { type: 'buffer' })
    });
  }

  /**
   * @param {Object} workbooks
   * @returns {Object}
   */
  parseWorkbooks(workbooks) {
    const thresholdResult = this.parseThresholds(workbooks.configWorkbook);
    const tableWeights = this.parseTableWeights(workbooks.weightWorkbook);

    return {
      version: 1,
      dailyPayoutLimitPoints: thresholdResult.dailyPayoutLimitPoints,
      stages: [1, 2, 3, 4, 5].map((stageNumber) => {
        const split = tableWeights[stageNumber];
        if (!split) {
          throw new Error('Missing low/high split weights for stage ' + stageNumber + '.');
        }

        return {
          stageNumber: stageNumber,
          turnoverThresholdPoints: this.requireNumber(thresholdResult.thresholds[stageNumber], 'stage ' + stageNumber + ' threshold'),
          lowTableWeight: split.low,
          highTableWeight: split.high,
          prizes: this.parseStagePrizes(workbooks, stageNumber)
        };
      })
    };
  }

  /**
   * @param {Object} files
   * @param {string} fileName
   * @returns {Buffer}
   */
  requireZipEntry(files, fileName) {
    const file = files[fileName];
    if (!file) {
      throw new Error('Missing ' + fileName + ' in uploaded probability zip.');
    }

    return file;
  }

  /**
   * @param {Object} workbook
   * @returns {{ thresholds: Object, dailyPayoutLimitPoints: number }}
   */
  parseThresholds(workbook) {
    const thresholds = {};
    let dailyPayoutLimitPoints = 0;
    const rows = this.getSheetRows(workbook, '門檻設置');

    rows.forEach((row) => {
      const dailyLimitIndex = row.findIndex(function (cell) {
        return normalizeText(cell) === '每日送出上限';
      });

      if (dailyLimitIndex >= 0) {
        dailyPayoutLimitPoints = this.readNextNumber(row, dailyLimitIndex + 1, 'daily payout limit');
        return;
      }

      for (let index = 0; index < row.length; index += 1) {
        const stageNumber = parseStageNumber(row[index]);
        if (stageNumber) {
          thresholds[stageNumber] = this.readNextNumber(row, index + 1, 'stage ' + stageNumber + ' threshold');
        }
      }
    });

    this.assertCompleteStages(thresholds, 'threshold');
    return {
      thresholds: thresholds,
      dailyPayoutLimitPoints: dailyPayoutLimitPoints
    };
  }

  /**
   * @param {Object} workbooks
   * @param {number} stageNumber
   * @returns {Object[]}
   */
  parseStagePrizes(workbooks, stageNumber) {
    const lowWeights = this.parsePrizeWeights(workbooks.lowWorkbook, stageNumber, 'low');
    const highWeights = this.parsePrizeWeights(workbooks.highWorkbook, stageNumber, 'high');
    const prizeWeights = this.parsePrizeWeights(workbooks.prizeWorkbook, stageNumber, 'prize');
    const dailyLimitWeights = this.parsePrizeWeights(workbooks.dailyLimitWorkbook, stageNumber, 'dailyLimit');

    return this.parsePrizeAmounts(workbooks.configWorkbook, stageNumber).map((prize) => {
      return {
        rewardCode: prize.rewardCode,
        name: prize.name,
        amountPoints: prize.amountPoints,
        lowWeight: this.requireNumber(lowWeights[prize.rewardCode], 'stage ' + stageNumber + ' ' + prize.rewardCode + ' low weight'),
        highWeight: this.requireNumber(highWeights[prize.rewardCode], 'stage ' + stageNumber + ' ' + prize.rewardCode + ' high weight'),
        prizeWeight: this.requireNumber(prizeWeights[prize.rewardCode], 'stage ' + stageNumber + ' ' + prize.rewardCode + ' prize weight'),
        dailyLimitWeight: this.requireNumber(dailyLimitWeights[prize.rewardCode], 'stage ' + stageNumber + ' ' + prize.rewardCode + ' dailyLimit weight'),
        sortOrder: prize.sortOrder
      };
    });
  }

  /**
   * @param {Object} workbook
   * @param {number} stageNumber
   * @returns {Object[]}
   */
  parsePrizeAmounts(workbook, stageNumber) {
    const prizes = [];
    const rows = this.getSheetRows(workbook, 'PrizeLV' + stageNumber);

    rows.forEach((row) => {
      const rewardIndex = row.findIndex(function (cell) {
        return REWARD_CODES.indexOf(normalizeText(cell)) !== -1;
      });

      if (rewardIndex < 0) {
        return;
      }

      const rewardCode = normalizeText(row[rewardIndex]);
      prizes.push({
        rewardCode: rewardCode,
        name: normalizeText(row[rewardIndex + 1]) || rewardCode + ' Prize',
        amountPoints: this.readNextNumber(row, rewardIndex + 1, 'stage ' + stageNumber + ' ' + rewardCode + ' amount'),
        sortOrder: REWARD_CODES.indexOf(rewardCode) + 1
      });
    });

    const amounts = {};
    prizes.forEach(function (prize) {
      amounts[prize.rewardCode] = prize.amountPoints;
    });
    this.assertCompleteRewards(amounts, 'stage ' + stageNumber + ' prize amounts');

    return prizes.sort(function (left, right) {
      return left.sortOrder - right.sortOrder;
    });
  }

  /**
   * @param {Object} workbook
   * @param {number} stageNumber
   * @param {string} tableName
   * @returns {Object}
   */
  parsePrizeWeights(workbook, stageNumber, tableName) {
    const weights = {};
    const rows = this.getSheetRows(workbook, 'LV' + stageNumber);

    rows.forEach((row) => {
      const rewardIndex = row.findIndex(function (cell) {
        return REWARD_CODES.indexOf(normalizeText(cell)) !== -1;
      });

      if (rewardIndex < 0) {
        return;
      }

      const rewardCode = normalizeText(row[rewardIndex]);
      weights[rewardCode] = this.readNextNumber(row, rewardIndex + 1, 'stage ' + stageNumber + ' ' + rewardCode + ' ' + tableName + ' weight');
    });

    this.assertCompleteRewards(weights, 'stage ' + stageNumber + ' ' + tableName + ' weights');
    return weights;
  }

  /**
   * @param {Object} workbook
   * @returns {Object}
   */
  parseTableWeights(workbook) {
    const splits = {};
    let currentStage = null;
    const rows = this.getSheetRows(workbook, 'Weight');

    rows.forEach((row) => {
      const stageNumber = row.map(parseStageNumber).find(Boolean);
      if (stageNumber) {
        currentStage = stageNumber;
        if (!splits[stageNumber]) {
          splits[stageNumber] = { low: 0, high: 0 };
        }
        return;
      }

      if (!currentStage) {
        return;
      }

      const tableIndex = row.findIndex(function (cell) {
        const text = normalizeText(cell).toLowerCase();
        return text === 'low' || text === 'high';
      });

      if (tableIndex < 0) {
        return;
      }

      const table = normalizeText(row[tableIndex]).toLowerCase();
      splits[currentStage][table] = this.readNextNumber(row, tableIndex + 1, 'stage ' + currentStage + ' ' + table + ' split weight');
    });

    [1, 2, 3, 4, 5].forEach(function (stageNumber) {
      const split = splits[stageNumber];
      if (!split || split.low + split.high <= 0) {
        throw new Error('Missing low/high split weights for stage ' + stageNumber + '.');
      }
    });

    return splits;
  }

  /**
   * @param {Object} workbook
   * @param {string} sheetName
   * @returns {Array<Array<*>>}
   */
  getSheetRows(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error('Missing worksheet: ' + sheetName + '.');
    }

    return XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: true
    });
  }

  /**
   * @param {Array<*>} row
   * @param {number} fromIndex
   * @param {string} label
   * @returns {number}
   */
  readNextNumber(row, fromIndex, label) {
    for (let index = fromIndex; index < row.length; index += 1) {
      const parsed = parseNumber(row[index]);
      if (parsed !== undefined) {
        return parsed;
      }
    }

    throw new Error('Missing numeric value for ' + label + '.');
  }

  /**
   * @param {number|undefined} value
   * @param {string} label
   * @returns {number}
   */
  requireNumber(value, label) {
    if (value === undefined) {
      throw new Error('Missing numeric value for ' + label + '.');
    }

    return value;
  }

  /**
   * @param {Object} values
   * @param {string} label
   * @returns {void}
   */
  assertCompleteStages(values, label) {
    [1, 2, 3, 4, 5].forEach(function (stageNumber) {
      if (values[stageNumber] === undefined) {
        throw new Error('Missing stage ' + stageNumber + ' ' + label + '.');
      }
    });
  }

  /**
   * @param {Object} values
   * @param {string} label
   * @returns {void}
   */
  assertCompleteRewards(values, label) {
    REWARD_CODES.forEach(function (rewardCode) {
      if (values[rewardCode] === undefined) {
        throw new Error('Missing reward ' + rewardCode + ' in ' + label + '.');
      }
    });
  }
}

/**
 * @param {*} value
 * @returns {number|undefined}
 */
function parseStageNumber(value) {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  const lvMatch = text.match(/^(?:LV|Stage)\s*([1-5])$/i);
  if (lvMatch) {
    return Number(lvMatch[1]);
  }

  for (let index = 0; index < STAGE_TEXT_PAIRS.length; index += 1) {
    const pair = STAGE_TEXT_PAIRS[index];
    if (text.indexOf('第' + pair[0]) !== -1) {
      return pair[1];
    }
  }

  return undefined;
}

/**
 * @param {*} value
 * @returns {string}
 */
function normalizeText(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

/**
 * @param {*} value
 * @returns {number|undefined}
 */
function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return assertInteger(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '');
    if (trimmed !== '' && Number.isFinite(Number(trimmed))) {
      return assertInteger(Number(trimmed));
    }
  }

  return undefined;
}

/**
 * @param {number} value
 * @returns {number}
 */
function assertInteger(value) {
  if (!Number.isInteger(value)) {
    throw new Error('Expected integer point value, received ' + value + '.');
  }

  return value;
}

module.exports = ProbabilityXlsxParser;
