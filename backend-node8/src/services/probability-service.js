'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const HttpError = require('../utils/http-error');
const picker = require('../utils/probability-picker');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const REWARD_CODES = ['A', 'B', 'C', 'D', 'E'];

const DEFAULT_CONFIG = {
  version: 1,
  dailyPayoutLimitPoints: 0,
  stages: [1, 2, 3, 4, 5].map(function (stageNumber) {
    return {
      stageNumber: stageNumber,
      turnoverThresholdPoints: [1000, 3000, 6000, 10000, 15000][stageNumber - 1],
      lowTableWeight: 80,
      highTableWeight: 20,
      prizes: [
        createDefaultPrize('A', 'A Prize', 0, 500, 120, 120, 500, 1),
        createDefaultPrize('B', 'B Prize', stageNumber * 100, 280, 220, 220, 280, 2),
        createDefaultPrize('C', 'C Prize', stageNumber * 300, 150, 280, 280, 150, 3),
        createDefaultPrize('D', 'D Prize', stageNumber * 700, 60, 250, 250, 60, 4),
        createDefaultPrize('E', 'E Prize', stageNumber * 1500, 10, 130, 130, 10, 5)
      ]
    };
  })
};

/**
 * @typedef {'low'|'high'|'prize'|'dailyLimit'} ProbabilityTable
 */

/**
 * @typedef {Object} ProbabilityPrizeConfig
 * @property {string} rewardCode
 * @property {string} name
 * @property {number} amountPoints
 * @property {number} lowWeight
 * @property {number} highWeight
 * @property {number} prizeWeight
 * @property {number} dailyLimitWeight
 * @property {number} sortOrder
 */

/**
 * @typedef {Object} ProbabilityStageConfig
 * @property {number} stageNumber
 * @property {number} turnoverThresholdPoints
 * @property {number} lowTableWeight
 * @property {number} highTableWeight
 * @property {ProbabilityPrizeConfig[]} prizes
 */

/**
 * @typedef {Object} ProbabilityConfigFile
 * @property {number} version
 * @property {number} dailyPayoutLimitPoints
 * @property {ProbabilityStageConfig[]} stages
 */

/**
 * @typedef {Object} StageDrawConfig
 * @property {ProbabilityStageConfig} stage
 * @property {ProbabilityPrizeConfig[]} prizes
 */

/**
 * @typedef {Object} DrawPrizeResult
 * @property {ProbabilityTable} table
 * @property {ProbabilityPrizeConfig} prize
 */

/**
 * File-backed probability config service used by spin simulation and later real spins.
 */
class ProbabilityService {
  /**
   * @param {{ config: Object }} options
   */
  constructor(options) {
    this.config = options.config;
    this.configPath = this.config.probabilityConfigPath;
  }

  /**
   * @returns {Promise<ProbabilityConfigFile>}
   */
  async getConfig() {
    await this.ensureConfigFile();
    const raw = await readFile(this.configPath, 'utf8');
    let config = null;

    try {
      config = JSON.parse(raw);
    } catch (_err) {
      throw HttpError.badRequest('Probability config JSON is invalid.');
    }

    return this.normalizeConfig(config);
  }

  /**
   * @returns {Promise<ProbabilityStageConfig[]>}
   */
  async getStages() {
    const config = await this.getConfig();
    return config.stages;
  }

  /**
   * @returns {Promise<number>}
   */
  async getDailyPayoutLimitPoints() {
    const config = await this.getConfig();
    return config.dailyPayoutLimitPoints;
  }

  /**
   * @returns {Promise<Array<{ stageNumber: number, turnoverThresholdPoints: number }>>}
   */
  async getStageThresholds() {
    const stages = await this.getStages();
    return stages.map(function (stage) {
      return {
        stageNumber: stage.stageNumber,
        turnoverThresholdPoints: stage.turnoverThresholdPoints
      };
    });
  }

  /**
   * @param {number} stageNumber
   * @returns {Promise<StageDrawConfig>}
   */
  async getDrawConfigForStage(stageNumber) {
    const stages = await this.getStages();
    const stage = stages.find(function (item) {
      return item.stageNumber === stageNumber;
    });

    if (!stage) {
      throw HttpError.badRequest('Stage ' + stageNumber + ' is not configured.');
    }

    return {
      stage: stage,
      prizes: stage.prizes
    };
  }

  /**
   * @param {StageDrawConfig} config
   * @param {Function} [rng]
   * @returns {DrawPrizeResult}
   */
  drawPrizeFromConfig(config, rng) {
    const table = picker.pickProbabilityTable(config.stage.lowTableWeight, config.stage.highTableWeight, rng);
    return this.drawPrizeFromConfigForTable(config, table, rng);
  }

  /**
   * @param {StageDrawConfig} config
   * @param {ProbabilityTable} table
   * @param {Function} [rng]
   * @returns {DrawPrizeResult}
   */
  drawPrizeFromConfigForTable(config, table, rng) {
    const prize = picker.pickWeightedItem(
      config.prizes,
      (item) => this.getPrizeWeightForTable(item, table),
      rng
    );

    return {
      table: table,
      prize: prize
    };
  }

  /**
   * @param {number} stageNumber
   * @param {Function} [rng]
   * @returns {Promise<DrawPrizeResult>}
   */
  async drawPrize(stageNumber, rng) {
    return this.drawPrizeFromConfig(await this.getDrawConfigForStage(stageNumber), rng);
  }

  /**
   * @param {number} stageNumber
   * @param {ProbabilityTable} table
   * @param {Function} [rng]
   * @returns {Promise<DrawPrizeResult>}
   */
  async drawPrizeForTable(stageNumber, table, rng) {
    return this.drawPrizeFromConfigForTable(await this.getDrawConfigForStage(stageNumber), table, rng);
  }

  /**
   * @param {ProbabilityConfigFile} config
   * @returns {Promise<ProbabilityStageConfig[]>}
   */
  async replaceConfig(config) {
    const sortedConfig = this.normalizeConfig(config);
    await this.writeConfig(sortedConfig);
    return sortedConfig.stages;
  }

  /**
   * @param {ProbabilityConfigFile} config
   * @returns {ProbabilityConfigFile}
   */
  normalizeConfig(config) {
    const normalizedConfig = this.withLegacyDefaults(config);
    this.assertValidConfig(normalizedConfig);
    return this.sortConfig(normalizedConfig);
  }

  /**
   * @returns {Promise<void>}
   */
  async ensureConfigFile() {
    try {
      await readFile(this.configPath, 'utf8');
    } catch (err) {
      if (!err || err.code !== 'ENOENT') {
        throw err;
      }

      await this.writeConfig(DEFAULT_CONFIG);
    }
  }

  /**
   * @param {ProbabilityConfigFile} config
   * @returns {Promise<void>}
   */
  async writeConfig(config) {
    ensureDirectory(path.dirname(this.configPath));
    await writeFile(this.configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  }

  /**
   * @param {ProbabilityConfigFile} config
   * @returns {ProbabilityConfigFile}
   */
  sortConfig(config) {
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
   * @param {ProbabilityConfigFile} config
   * @returns {ProbabilityConfigFile}
   */
  withLegacyDefaults(config) {
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
   * @param {ProbabilityPrizeConfig} prize
   * @param {ProbabilityTable} table
   * @returns {number}
   */
  getPrizeWeightForTable(prize, table) {
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
   * @param {ProbabilityConfigFile} config
   * @returns {void}
   */
  assertValidConfig(config) {
    if (!Array.isArray(config.stages) || config.stages.length !== 5) {
      throw HttpError.badRequest('Probability config must define exactly five stages.');
    }

    const stageNumbers = config.stages.map(function (stage) {
      return stage.stageNumber;
    });

    if (new Set(stageNumbers).size !== 5 || ![1, 2, 3, 4, 5].every(function (stageNumber) {
      return stageNumbers.includes(stageNumber);
    })) {
      throw HttpError.badRequest('Probability config stages must be numbered 1 through 5.');
    }

    if (!Number.isInteger(config.dailyPayoutLimitPoints)) {
      throw HttpError.badRequest('Probability config daily payout limit must be an integer.');
    }

    config.stages.forEach((stage) => {
      this.assertValidStage(stage);
    });
  }

  /**
   * @param {ProbabilityStageConfig} stage
   * @returns {void}
   */
  assertValidStage(stage) {
    if (stage.turnoverThresholdPoints < 0 || stage.lowTableWeight < 0 || stage.highTableWeight < 0) {
      throw HttpError.badRequest('Stage ' + stage.stageNumber + ' contains negative numeric values.');
    }

    const rewardCodes = stage.prizes.map(function (prize) {
      return prize.rewardCode;
    });

    if (rewardCodes.length !== 5 || new Set(rewardCodes).size !== 5 || !REWARD_CODES.every(function (code) {
      return rewardCodes.includes(code);
    })) {
      throw HttpError.badRequest('Stage ' + stage.stageNumber + ' must define rewards A through E.');
    }

    if (stage.lowTableWeight + stage.highTableWeight <= 0) {
      throw HttpError.badRequest('Stage ' + stage.stageNumber + ' needs low/high table split weight.');
    }

    this.assertStageHasWeightedPrize(stage, 'lowWeight', 'low table');
    this.assertStageHasWeightedPrize(stage, 'highWeight', 'high table');
    this.assertStageHasWeightedPrize(stage, 'prizeWeight', 'prize table');
    this.assertStageHasWeightedPrize(stage, 'dailyLimitWeight', 'dailyLimit table');

    stage.prizes.forEach(function (prize) {
      if (
        prize.amountPoints < 0 ||
        prize.lowWeight < 0 ||
        prize.highWeight < 0 ||
        prize.prizeWeight < 0 ||
        prize.dailyLimitWeight < 0
      ) {
        throw HttpError.badRequest('Stage ' + stage.stageNumber + ' reward ' + prize.rewardCode + ' contains negative numeric values.');
      }
    });
  }

  /**
   * @param {ProbabilityStageConfig} stage
   * @param {string} weightKey
   * @param {string} label
   * @returns {void}
   */
  assertStageHasWeightedPrize(stage, weightKey, label) {
    const hasWeightedPrize = stage.prizes.some(function (prize) {
      return prize[weightKey] > 0;
    });

    if (!hasWeightedPrize) {
      throw HttpError.badRequest('Stage ' + stage.stageNumber + ' ' + label + ' needs at least one weighted prize.');
    }
  }
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
 * @returns {ProbabilityPrizeConfig}
 */
function createDefaultPrize(rewardCode, name, amountPoints, lowWeight, highWeight, prizeWeight, dailyLimitWeight, sortOrder) {
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
 * @param {ProbabilityStageConfig} left
 * @param {ProbabilityStageConfig} right
 * @returns {number}
 */
function sortStages(left, right) {
  return left.stageNumber - right.stageNumber;
}

/**
 * @param {ProbabilityPrizeConfig} left
 * @param {ProbabilityPrizeConfig} right
 * @returns {number}
 */
function sortPrizes(left, right) {
  return left.sortOrder - right.sortOrder || left.rewardCode.localeCompare(right.rewardCode);
}

/**
 * @param {ProbabilityPrizeConfig} prize
 * @returns {ProbabilityPrizeConfig}
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

/**
 * @param {string} dir
 * @returns {void}
 */
function ensureDirectory(dir) {
  if (!dir || fs.existsSync(dir)) {
    return;
  }

  ensureDirectory(path.dirname(dir));
  fs.mkdirSync(dir);
}

module.exports = ProbabilityService;
