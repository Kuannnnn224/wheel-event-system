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
 * 管理檔案型機率設定，供抽獎模擬與真實抽獎共用。
 */
class ProbabilityService {
  /**
   * 初始化機率設定 service，保存 config 與機率 JSON 路徑。
   *
   * @param {{ config: Object }} options
   */
  constructor(options) {
    this.config = options.config;
    this.configPath = this.config.probabilityConfigPath;
  }

  /**
   * 讀取並正規化目前機率設定檔。
   *
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
   * 取得前端需要的階段設定。
   *
   * @returns {Promise<ProbabilityStageConfig[]>}
   */
  async getStages() {
    const config = await this.getConfig();
    return config.stages;
  }

  /**
   * 取得每日派獎上限點數。
   *
   * @returns {Promise<number>}
   */
  async getDailyPayoutLimitPoints() {
    const config = await this.getConfig();
    return config.dailyPayoutLimitPoints;
  }

  /**
   * 取得各階段流水門檻，供 webview 顯示進度。
   *
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
   * 取得指定階段可抽獎用的機率設定。
   *
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
   * 依階段設定先選 low/high 表再抽獎項。
   *
   * @param {StageDrawConfig} config
   * @param {Function} [rng]
   * @returns {DrawPrizeResult}
   */
  drawPrizeFromConfig(config, rng) {
    const table = picker.pickProbabilityTable(config.stage.lowTableWeight, config.stage.highTableWeight, rng);
    return this.drawPrizeFromConfigForTable(config, table, rng);
  }

  /**
   * 直接使用指定機率表抽獎項。
   *
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
   * 依 stageNumber 抽出一般流程獎項。
   *
   * @param {number} stageNumber
   * @param {Function} [rng]
   * @returns {Promise<DrawPrizeResult>}
   */
  async drawPrize(stageNumber, rng) {
    return this.drawPrizeFromConfig(await this.getDrawConfigForStage(stageNumber), rng);
  }

  /**
   * 依 stageNumber 與指定表抽出獎項。
   *
   * @param {number} stageNumber
   * @param {ProbabilityTable} table
   * @param {Function} [rng]
   * @returns {Promise<DrawPrizeResult>}
   */
  async drawPrizeForTable(stageNumber, table, rng) {
    return this.drawPrizeFromConfigForTable(await this.getDrawConfigForStage(stageNumber), table, rng);
  }

  /**
   * 正規化並寫入新的機率設定。
   *
   * @param {ProbabilityConfigFile} config
   * @returns {Promise<ProbabilityStageConfig[]>}
   */
  async replaceConfig(config) {
    const sortedConfig = this.normalizeConfig(config);
    await this.writeConfig(sortedConfig);
    return sortedConfig.stages;
  }

  /**
   * 補齊 legacy 欄位並排序機率設定。
   *
   * @param {ProbabilityConfigFile} config
   * @returns {ProbabilityConfigFile}
   */
  normalizeConfig(config) {
    const normalizedConfig = this.withLegacyDefaults(config);
    this.assertValidConfig(normalizedConfig);
    return this.sortConfig(normalizedConfig);
  }

  /**
   * 確認機率設定檔存在，缺少時寫入預設值。
   *
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
   * 把機率設定寫回 JSON 檔案。
   *
   * @param {ProbabilityConfigFile} config
   * @returns {Promise<void>}
   */
  async writeConfig(config) {
    ensureDirectory(path.dirname(this.configPath));
    await writeFile(this.configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  }

  /**
   * 依階段與獎項順序整理機率設定。
   *
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
   * 替舊格式機率設定補上新版欄位預設值。
   *
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
   * 依機率表名稱取得獎項對應權重。
   *
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
   * 檢查完整機率設定是否可被後端使用。
   *
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
   * 檢查單一階段設定是否完整有效。
   *
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
   * 確認指定權重欄位至少有一個獎項可被抽中。
   *
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
 * 建立預設機率設定中的單一獎項。
 *
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
 * 依 stageNumber 由小到大排序階段設定。
 *
 * @param {ProbabilityStageConfig} left
 * @param {ProbabilityStageConfig} right
 * @returns {number}
 */
function sortStages(left, right) {
  return left.stageNumber - right.stageNumber;
}

/**
 * 依 sortOrder 由小到大排序獎項設定。
 *
 * @param {ProbabilityPrizeConfig} left
 * @param {ProbabilityPrizeConfig} right
 * @returns {number}
 */
function sortPrizes(left, right) {
  return left.sortOrder - right.sortOrder || left.rewardCode.localeCompare(right.rewardCode);
}

/**
 * 複製獎項設定，避免外部修改原始 config。
 *
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
 * 遞迴建立目標資料夾，確保後續寫檔可成功。
 *
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
