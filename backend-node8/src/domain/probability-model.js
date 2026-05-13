'use strict';

const picker = require('../utils/probability-picker');

const REWARD_CODES = ['A', 'B', 'C', 'D', 'E'];

/**
 * 表示機率設定或模型輸入不合法。這個錯誤刻意不依賴 HTTP layer。
 *
 * @param {string} message
 */
function ProbabilityModelError(message) {
  this.name = 'ProbabilityModelError';
  this.message = message;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, ProbabilityModelError);
  } else {
    this.stack = new Error(message).stack;
  }
}

ProbabilityModelError.prototype = Object.create(Error.prototype);
ProbabilityModelError.prototype.constructor = ProbabilityModelError;

/**
 * 建立預設機率設定。
 *
 * @returns {Object}
 */
function createDefaultConfig() {
  return {
    version: 1,
    dailyPayoutLimitPoints: 0,
    stages: [1, 2, 3, 4, 5].map(function (stageNumber) {
      return {
        stageNumber: stageNumber,
        turnoverThresholdPoints: [1000, 3000, 6000, 10000, 15000][stageNumber - 1],
        lowTableWeight: 80,
        highTableWeight: 20,
        prizes: [
          createPrize('A', 'A Prize', 0, 500, 120, 120, 500, 1),
          createPrize('B', 'B Prize', stageNumber * 100, 280, 220, 220, 280, 2),
          createPrize('C', 'C Prize', stageNumber * 300, 150, 280, 280, 150, 3),
          createPrize('D', 'D Prize', stageNumber * 700, 60, 250, 250, 60, 4),
          createPrize('E', 'E Prize', stageNumber * 1500, 10, 130, 130, 10, 5)
        ]
      };
    })
  };
}

/**
 * 補齊 legacy 欄位、驗證並排序機率設定。
 *
 * @param {Object} config
 * @returns {Object}
 */
function normalizeConfig(config) {
  const normalizedConfig = withLegacyDefaults(config);

  assertValidConfig(normalizedConfig);
  return sortConfig(normalizedConfig);
}

/**
 * 依階段與獎項順序整理機率設定。
 *
 * @param {Object} config
 * @returns {Object}
 */
function sortConfig(config) {
  return {
    version: config.version,
    dailyPayoutLimitPoints: config.dailyPayoutLimitPoints,
    stages: config.stages.slice().sort(sortStages).map(function (stage) {
      return {
        stageNumber: stage.stageNumber,
        turnoverThresholdPoints: stage.turnoverThresholdPoints,
        lowTableWeight: stage.lowTableWeight,
        highTableWeight: stage.highTableWeight,
        prizes: stage.prizes.slice().sort(sortPrizes).map(clonePrize)
      };
    })
  };
}

/**
 * 替舊格式機率設定補上新版欄位預設值。
 *
 * @param {Object} config
 * @returns {Object}
 */
function withLegacyDefaults(config) {
  if (!config || typeof config !== 'object') {
    throwConfigError('Probability config must be an object.');
  }

  const dailyPayoutLimitPoints = config.dailyPayoutLimitPoints === undefined || config.dailyPayoutLimitPoints === null
    ? 0
    : config.dailyPayoutLimitPoints;

  return {
    version: config.version,
    dailyPayoutLimitPoints: dailyPayoutLimitPoints,
    stages: Array.isArray(config.stages) ? config.stages.map(function (stage) {
      return {
        stageNumber: stage.stageNumber,
        turnoverThresholdPoints: stage.turnoverThresholdPoints,
        lowTableWeight: stage.lowTableWeight,
        highTableWeight: stage.highTableWeight,
        prizes: Array.isArray(stage.prizes) ? stage.prizes.map(function (prize) {
          return {
            rewardCode: prize.rewardCode,
            name: prize.name,
            amountPoints: prize.amountPoints,
            lowWeight: prize.lowWeight,
            highWeight: prize.highWeight,
            prizeWeight: prize.prizeWeight === undefined || prize.prizeWeight === null ? prize.highWeight : prize.prizeWeight,
            dailyLimitWeight: prize.dailyLimitWeight === undefined || prize.dailyLimitWeight === null ? prize.lowWeight : prize.dailyLimitWeight,
            sortOrder: prize.sortOrder
          };
        }) : stage.prizes
      };
    }) : config.stages
  };
}

/**
 * 依階段設定先選 low/high 表再抽獎項。
 *
 * @param {{ stage: Object, prizes: Object[] }} config
 * @param {Function} [rng]
 * @returns {{ table: string, prize: Object }}
 */
function drawPrizeFromConfig(config, rng) {
  const table = picker.pickProbabilityTable(config.stage.lowTableWeight, config.stage.highTableWeight, rng);

  return drawPrizeFromConfigForTable(config, table, rng);
}

/**
 * 直接使用指定機率表抽獎項。
 *
 * @param {{ stage: Object, prizes: Object[] }} config
 * @param {string} table
 * @param {Function} [rng]
 * @returns {{ table: string, prize: Object }}
 */
function drawPrizeFromConfigForTable(config, table, rng) {
  const prize = picker.pickWeightedItem(
    config.prizes,
    function (item) {
      return getPrizeWeightForTable(item, table);
    },
    rng
  );

  return {
    table: table,
    prize: prize
  };
}

/**
 * 依機率表名稱取得獎項對應權重。
 *
 * @param {Object} prize
 * @param {string} table
 * @returns {number}
 */
function getPrizeWeightForTable(prize, table) {
  if (table === 'low') {
    return prize.lowWeight;
  }

  if (table === 'high') {
    return prize.highWeight;
  }

  if (table === 'dailyLimit') {
    return prize.dailyLimitWeight;
  }

  return prize.prizeWeight;
}

/**
 * 檢查完整機率設定是否可被後端使用。
 *
 * @param {Object} config
 * @returns {void}
 */
function assertValidConfig(config) {
  if (!Array.isArray(config.stages) || config.stages.length !== 5) {
    throwConfigError('Probability config must define exactly five stages.');
  }

  const stageNumbers = config.stages.map(function (stage) {
    return stage.stageNumber;
  });

  if (new Set(stageNumbers).size !== 5 || ![1, 2, 3, 4, 5].every(function (stageNumber) {
    return stageNumbers.indexOf(stageNumber) !== -1;
  })) {
    throwConfigError('Probability config stages must be numbered 1 through 5.');
  }

  if (!Number.isInteger(config.dailyPayoutLimitPoints)) {
    throwConfigError('Probability config daily payout limit must be an integer.');
  }

  config.stages.forEach(function (stage) {
    assertValidStage(stage);
  });
}

/**
 * 檢查單一階段設定是否完整有效。
 *
 * @param {Object} stage
 * @returns {void}
 */
function assertValidStage(stage) {
  if (!stage || typeof stage !== 'object') {
    throwConfigError('Probability config contains an invalid stage.');
  }

  if (!Array.isArray(stage.prizes)) {
    throwConfigError('Stage ' + stage.stageNumber + ' must define rewards A through E.');
  }

  if (stage.turnoverThresholdPoints < 0 || stage.lowTableWeight < 0 || stage.highTableWeight < 0) {
    throwConfigError('Stage ' + stage.stageNumber + ' contains negative numeric values.');
  }

  const rewardCodes = stage.prizes.map(function (prize) {
    return prize.rewardCode;
  });

  if (rewardCodes.length !== 5 || new Set(rewardCodes).size !== 5 || !REWARD_CODES.every(function (code) {
    return rewardCodes.indexOf(code) !== -1;
  })) {
    throwConfigError('Stage ' + stage.stageNumber + ' must define rewards A through E.');
  }

  if (stage.lowTableWeight + stage.highTableWeight <= 0) {
    throwConfigError('Stage ' + stage.stageNumber + ' needs low/high table split weight.');
  }

  assertStageHasWeightedPrize(stage, 'lowWeight', 'low table');
  assertStageHasWeightedPrize(stage, 'highWeight', 'high table');
  assertStageHasWeightedPrize(stage, 'prizeWeight', 'prize table');
  assertStageHasWeightedPrize(stage, 'dailyLimitWeight', 'dailyLimit table');

  stage.prizes.forEach(function (prize) {
    if (
      prize.amountPoints < 0 ||
      prize.lowWeight < 0 ||
      prize.highWeight < 0 ||
      prize.prizeWeight < 0 ||
      prize.dailyLimitWeight < 0
    ) {
      throwConfigError('Stage ' + stage.stageNumber + ' reward ' + prize.rewardCode + ' contains negative numeric values.');
    }
  });
}

/**
 * 確認指定權重欄位至少有一個獎項可被抽中。
 *
 * @param {Object} stage
 * @param {string} weightKey
 * @param {string} label
 * @returns {void}
 */
function assertStageHasWeightedPrize(stage, weightKey, label) {
  const hasWeightedPrize = stage.prizes.some(function (prize) {
    return prize[weightKey] > 0;
  });

  if (!hasWeightedPrize) {
    throwConfigError('Stage ' + stage.stageNumber + ' ' + label + ' needs at least one weighted prize.');
  }
}

/**
 * @param {*} err
 * @returns {boolean}
 */
function isProbabilityModelError(err) {
  return err instanceof ProbabilityModelError || Boolean(err && err.name === 'ProbabilityModelError');
}

/**
 * @param {string} message
 * @returns {never}
 */
function throwConfigError(message) {
  throw new ProbabilityModelError(message);
}

/**
 * @param {string} rewardCode
 * @param {string} name
 * @param {number} amountPoints
 * @param {number} lowWeight
 * @param {number} highWeight
 * @param {number} prizeWeight
 * @param {number} dailyLimitWeight
 * @param {number} sortOrder
 * @returns {Object}
 */
function createPrize(rewardCode, name, amountPoints, lowWeight, highWeight, prizeWeight, dailyLimitWeight, sortOrder) {
  return {
    rewardCode: rewardCode,
    name: name,
    amountPoints: amountPoints,
    lowWeight: lowWeight,
    highWeight: highWeight,
    prizeWeight: prizeWeight,
    dailyLimitWeight: dailyLimitWeight,
    sortOrder: sortOrder
  };
}

/**
 * @param {Object} left
 * @param {Object} right
 * @returns {number}
 */
function sortStages(left, right) {
  return left.stageNumber - right.stageNumber;
}

/**
 * @param {Object} left
 * @param {Object} right
 * @returns {number}
 */
function sortPrizes(left, right) {
  return left.sortOrder - right.sortOrder || left.rewardCode.localeCompare(right.rewardCode);
}

/**
 * @param {Object} prize
 * @returns {Object}
 */
function clonePrize(prize) {
  return {
    rewardCode: prize.rewardCode,
    name: prize.name,
    amountPoints: prize.amountPoints,
    lowWeight: prize.lowWeight,
    highWeight: prize.highWeight,
    prizeWeight: prize.prizeWeight,
    dailyLimitWeight: prize.dailyLimitWeight,
    sortOrder: prize.sortOrder
  };
}

module.exports = {
  ProbabilityModelError: ProbabilityModelError,
  assertStageHasWeightedPrize: assertStageHasWeightedPrize,
  assertValidConfig: assertValidConfig,
  assertValidStage: assertValidStage,
  createDefaultConfig: createDefaultConfig,
  drawPrizeFromConfig: drawPrizeFromConfig,
  drawPrizeFromConfigForTable: drawPrizeFromConfigForTable,
  getPrizeWeightForTable: getPrizeWeightForTable,
  isProbabilityModelError: isProbabilityModelError,
  normalizeConfig: normalizeConfig,
  sortConfig: sortConfig,
  withLegacyDefaults: withLegacyDefaults
};
