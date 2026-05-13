'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const probabilityModel = require('../domain/probability-model');
const HttpError = require('../utils/http-error');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

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
 *
 * 機率模型本身放在 domain/probability-model；這個 service 只負責檔案 IO
 * 與把 domain validation error 轉成 API error。
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
    return probabilityModel.drawPrizeFromConfig(config, rng);
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
    return probabilityModel.drawPrizeFromConfigForTable(config, table, rng);
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
    return this.runModel(function () {
      return probabilityModel.normalizeConfig(config);
    });
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

      await this.writeConfig(probabilityModel.createDefaultConfig());
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
    return this.runModel(function () {
      return probabilityModel.sortConfig(config);
    });
  }

  /**
   * 替舊格式機率設定補上新版欄位預設值。
   *
   * @param {ProbabilityConfigFile} config
   * @returns {ProbabilityConfigFile}
   */
  withLegacyDefaults(config) {
    return this.runModel(function () {
      return probabilityModel.withLegacyDefaults(config);
    });
  }

  /**
   * 依機率表名稱取得獎項對應權重。
   *
   * @param {ProbabilityPrizeConfig} prize
   * @param {ProbabilityTable} table
   * @returns {number}
   */
  getPrizeWeightForTable(prize, table) {
    return probabilityModel.getPrizeWeightForTable(prize, table);
  }

  /**
   * 檢查完整機率設定是否可被後端使用。
   *
   * @param {ProbabilityConfigFile} config
   * @returns {void}
   */
  assertValidConfig(config) {
    this.runModel(function () {
      probabilityModel.assertValidConfig(config);
    });
  }

  /**
   * 檢查單一階段設定是否完整有效。
   *
   * @param {ProbabilityStageConfig} stage
   * @returns {void}
   */
  assertValidStage(stage) {
    this.runModel(function () {
      probabilityModel.assertValidStage(stage);
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
    this.runModel(function () {
      probabilityModel.assertStageHasWeightedPrize(stage, weightKey, label);
    });
  }

  /**
   * 把純模型錯誤轉成既有 API 錯誤格式。
   *
   * @param {Function} callback
   * @returns {*}
   */
  runModel(callback) {
    try {
      return callback();
    } catch (err) {
      if (probabilityModel.isProbabilityModelError(err)) {
        throw HttpError.badRequest(err.message);
      }

      throw err;
    }
  }
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
