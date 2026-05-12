'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const HttpError = require('../utils/http-error');
const ids = require('../utils/ids');
const ProbabilityXlsxParser = require('./probability-xlsx-parser');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const readdir = util.promisify(fs.readdir);

const DIFF_FIELD_LABELS = {
  dailyPayoutLimitPoints: '每日送出上限',
  turnoverThresholdPoints: '流水門檻',
  lowTableWeight: 'Low 表分流權重',
  highTableWeight: 'High 表分流權重',
  name: '獎項名稱',
  amountPoints: '獎勵點數',
  lowWeight: 'Low 權重',
  highWeight: 'High 權重',
  prizeWeight: '指定派獎權重',
  dailyLimitWeight: 'DailyLimit 權重',
  sortOrder: '排序'
};

/**
 * Handles probability import upload preview, apply, and download links.
 */
class ProbabilityImportsService {
  /**
   * @param {{ config: Object, probabilityService: import('./probability-service') }} options
   */
  constructor(options) {
    this.config = options.config;
    this.probabilityService = options.probabilityService;
    this.parser = new ProbabilityXlsxParser();
    this.importStoragePath = this.config.probabilityImportStoragePath;
    this.downloadTokens = {};
  }

  /**
   * @param {{ buffer: Buffer, originalname: string, size: number }} file
   * @returns {Promise<Object>}
   */
  async previewImportZip(file) {
    const proposedConfig = this.parseImportZip(file);
    const upload = await this.storeImportZip(file);
    const currentConfig = await this.probabilityService.getConfig();

    return {
      filename: file.originalname,
      upload: upload,
      diff: this.buildConfigDiff(currentConfig, proposedConfig),
      proposedConfig: proposedConfig
    };
  }

  /**
   * @param {string} uploadId
   * @returns {Promise<Object>}
   */
  async applyImportUpload(uploadId) {
    const importFile = await this.getImportFile(uploadId);
    const buffer = await readFile(importFile.path);
    const proposedConfig = this.parseImportZip({
      buffer: buffer,
      originalname: importFile.metadata.originalFilename,
      size: importFile.metadata.fileSize
    });
    const currentConfig = await this.probabilityService.getConfig();
    const stages = await this.probabilityService.replaceConfig(proposedConfig);
    const appliedConfig = {
      version: proposedConfig.version,
      dailyPayoutLimitPoints: proposedConfig.dailyPayoutLimitPoints,
      stages: stages
    };

    return {
      upload: importFile.metadata,
      diff: this.buildConfigDiff(currentConfig, appliedConfig),
      dailyPayoutLimitPoints: proposedConfig.dailyPayoutLimitPoints,
      stages: stages
    };
  }

  /**
   * @returns {Promise<Object[]>}
   */
  async listImportUploads() {
    ensureDirectory(this.importStoragePath);
    const files = await readdir(this.importStoragePath);
    const metadataFiles = files.filter(function (file) {
      return /\.json$/.test(file);
    });
    const uploads = [];

    for (let index = 0; index < metadataFiles.length; index += 1) {
      const raw = await readFile(path.join(this.importStoragePath, metadataFiles[index]), 'utf8');
      uploads.push(JSON.parse(raw));
    }

    return uploads.sort(function (left, right) {
      return right.uploadedAt.localeCompare(left.uploadedAt);
    });
  }

  /**
   * @param {string} uploadId
   * @returns {Promise<Object>}
   */
  async getImportFile(uploadId) {
    if (!uploadId || !/^[a-zA-Z0-9-]+$/.test(uploadId)) {
      throw HttpError.badRequest('Invalid probability import id.');
    }

    const metadataPath = path.join(this.importStoragePath, uploadId + '.json');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));

    return {
      path: path.join(this.importStoragePath, metadata.storedFilename),
      metadata: metadata
    };
  }

  /**
   * @param {string} uploadId
   * @returns {Promise<Object>}
   */
  async createDownloadToken(uploadId) {
    await this.getImportFile(uploadId);
    const token = ids.randomToken();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    this.downloadTokens[token] = {
      uploadId: uploadId,
      expiresAt: expiresAt
    };

    return {
      token: token,
      downloadUrl: '/probability/imports/download/' + token,
      expiresAt: new Date(expiresAt).toISOString()
    };
  }

  /**
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async getImportFileByDownloadToken(token) {
    const tokenInfo = this.downloadTokens[token];

    if (!tokenInfo || tokenInfo.expiresAt < Date.now()) {
      delete this.downloadTokens[token];
      throw HttpError.badRequest('Probability import download link is expired.');
    }

    return this.getImportFile(tokenInfo.uploadId);
  }

  /**
   * @param {{ buffer: Buffer, originalname: string }} file
   * @returns {Object}
   */
  parseImportZip(file) {
    if (!file || !file.buffer || !file.buffer.length) {
      throw HttpError.badRequest('Probability zip file is required.');
    }

    if (!String(file.originalname || '').toLowerCase().endsWith('.zip')) {
      throw HttpError.badRequest('Probability import file must be a .zip archive.');
    }

    try {
      return this.probabilityService.normalizeConfig(this.parser.parseZip(file.buffer));
    } catch (err) {
      const message = err && err.message ? err.message : 'Unknown parser error.';
      throw HttpError.badRequest('Failed to parse probability zip: ' + message);
    }
  }

  /**
   * @param {{ buffer: Buffer, originalname: string, size: number }} file
   * @returns {Promise<Object>}
   */
  async storeImportZip(file) {
    ensureDirectory(this.importStoragePath);
    const id = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + ids.randomHex(4);
    const storedFilename = id + '.zip';
    const metadata = {
      id: id,
      originalFilename: path.basename(file.originalname),
      storedFilename: storedFilename,
      fileSize: file.size || file.buffer.length,
      uploadedAt: new Date().toISOString()
    };

    await writeFile(path.join(this.importStoragePath, storedFilename), file.buffer);
    await writeFile(path.join(this.importStoragePath, id + '.json'), JSON.stringify(metadata, null, 2) + '\n', 'utf8');

    return metadata;
  }

  /**
   * @param {Object} current
   * @param {Object} proposed
   * @returns {Object[]}
   */
  buildConfigDiff(current, proposed) {
    const diff = [];
    const currentStages = {};

    current.stages.forEach(function (stage) {
      currentStages[stage.stageNumber] = stage;
    });

    this.pushDiff(diff, 0, undefined, 'dailyPayoutLimitPoints', current.dailyPayoutLimitPoints || 0, proposed.dailyPayoutLimitPoints || 0);

    proposed.stages.forEach((proposedStage) => {
      const currentStage = currentStages[proposedStage.stageNumber];
      if (!currentStage) {
        diff.push({
          key: 'stage-' + proposedStage.stageNumber + '-new',
          stageNumber: proposedStage.stageNumber,
          field: 'stage',
          label: 'Stage ' + proposedStage.stageNumber + ' 新增',
          before: null,
          after: '新增階段'
        });
        return;
      }

      this.pushDiff(diff, proposedStage.stageNumber, undefined, 'turnoverThresholdPoints', currentStage.turnoverThresholdPoints, proposedStage.turnoverThresholdPoints);
      this.pushDiff(diff, proposedStage.stageNumber, undefined, 'lowTableWeight', currentStage.lowTableWeight, proposedStage.lowTableWeight);
      this.pushDiff(diff, proposedStage.stageNumber, undefined, 'highTableWeight', currentStage.highTableWeight, proposedStage.highTableWeight);

      const currentPrizes = {};
      currentStage.prizes.forEach(function (prize) {
        currentPrizes[prize.rewardCode] = prize;
      });

      proposedStage.prizes.forEach((proposedPrize) => {
        const currentPrize = currentPrizes[proposedPrize.rewardCode];
        if (!currentPrize) {
          diff.push({
            key: 'stage-' + proposedStage.stageNumber + '-prize-' + proposedPrize.rewardCode + '-new',
            stageNumber: proposedStage.stageNumber,
            rewardCode: proposedPrize.rewardCode,
            field: 'prize',
            label: 'Stage ' + proposedStage.stageNumber + ' / ' + proposedPrize.rewardCode + ' 獎 新增',
            before: null,
            after: proposedPrize.name
          });
          return;
        }

        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'name', currentPrize.name, proposedPrize.name);
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'amountPoints', currentPrize.amountPoints, proposedPrize.amountPoints);
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'lowWeight', currentPrize.lowWeight, proposedPrize.lowWeight);
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'highWeight', currentPrize.highWeight, proposedPrize.highWeight);
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'prizeWeight', currentPrize.prizeWeight, proposedPrize.prizeWeight);
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'dailyLimitWeight', currentPrize.dailyLimitWeight, proposedPrize.dailyLimitWeight);
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'sortOrder', currentPrize.sortOrder, proposedPrize.sortOrder);
      });
    });

    return diff;
  }

  /**
   * @param {Object[]} diff
   * @param {number} stageNumber
   * @param {string|undefined} rewardCode
   * @param {string} field
   * @param {string|number|null} before
   * @param {string|number|null} after
   * @returns {void}
   */
  pushDiff(diff, stageNumber, rewardCode, field, before, after) {
    if (before === after) {
      return;
    }

    diff.push({
      key: 'stage-' + stageNumber + '-' + (rewardCode || 'stage') + '-' + field,
      stageNumber: stageNumber,
      rewardCode: rewardCode,
      field: field,
      label: this.getDiffLabel(stageNumber, rewardCode, field),
      before: before,
      after: after
    });
  }

  /**
   * @param {number} stageNumber
   * @param {string|undefined} rewardCode
   * @param {string} field
   * @returns {string}
   */
  getDiffLabel(stageNumber, rewardCode, field) {
    const label = DIFF_FIELD_LABELS[field] || field;

    if (stageNumber === 0) {
      return label;
    }

    if (rewardCode) {
      return 'Stage ' + stageNumber + ' / ' + rewardCode + ' 獎 / ' + label;
    }

    return 'Stage ' + stageNumber + ' / ' + label;
  }
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

module.exports = ProbabilityImportsService;
