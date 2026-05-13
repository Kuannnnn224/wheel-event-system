'use strict';

const HttpError = require('../utils/http-error');
const time = require('../utils/time');

const AWARD_OVERRIDE_STATUSES = ['pending', 'consumed', 'cancelled'];

/**
 * 處理後控建立的指定派獎規則。
 */
class AwardOverridesService {
  /**
   * 初始化指定派獎 service，保存玩家、抽獎紀錄與指定派獎 repository。
   *
   * @param {Object} options
   * @param {Object} options.config
   * @param {import('../db').Database} options.db
   * @param {import('../repositories/award-overrides-repository')} options.awardOverridesRepository
   * @param {import('./players-service')} options.playersService
   * @param {import('../repositories/spin-records-repository')} options.spinRecordsRepository
   */
  constructor(options) {
    this.config = options.config;
    this.db = options.db;
    this.awardOverridesRepository = options.awardOverridesRepository;
    this.playersService = options.playersService;
    this.spinRecordsRepository = options.spinRecordsRepository;
  }

  /**
   * 列出今日指定派獎規則，可用狀態與平台玩家 ID 篩選。
   *
   * @param {string|undefined} status
   * @param {string|undefined} playerId
   * @returns {Promise<Object[]>}
   */
  async list(status, playerId) {
    const normalizedStatus = status && status !== 'all' ? this.assertStatus(status) : undefined;
    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);

    return this.awardOverridesRepository.list({
      businessDate: businessDate,
      status: normalizedStatus,
      playerId: playerId
    });
  }

  /**
   * 建立今日指定派獎規則，並避免已抽過或已有 pending 規則的階段重複建立。
   *
   * @param {Object} input
   * @param {string|undefined} adminId
   * @returns {Promise<Object[]>}
   */
  async create(input, adminId) {
    const dto = this.parseCreateInput(input);
    const player = await this.playersService.findByPlayerId(dto.playerId);

    if (!player) {
      throw HttpError.notFound('找不到玩家，請先建立玩家後再新增指定派獎。');
    }

    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);

    return this.db.withTransaction(async (tx) => {
      const existingSpins = await this.spinRecordsRepository.findByPlayerDateAndStages(player.id, businessDate, dto.stageNumbers, tx);

      if (existingSpins.length > 0) {
        const playedStages = existingSpins.map((spin) => spin.stageNumber).sort(sortNumbers);
        throw HttpError.badRequest('玩家 ' + player.id + ' 今天 ' + this.formatStages(playedStages) + ' 已經抽過，該階段轉盤次數已用盡，不能新增指定派獎。');
      }

      const pendingKeys = dto.stageNumbers.map((stageNumber) => this.buildPendingKey(player.id, businessDate, stageNumber));
      const existingRules = await this.awardOverridesRepository.findByPendingKeys(pendingKeys, tx);

      if (existingRules.length > 0) {
        const duplicatedStages = existingRules.map((rule) => rule.stageNumber).sort(sortNumbers);
        throw HttpError.badRequest('玩家 ' + player.id + ' 今天 ' + this.formatStages(duplicatedStages) + ' 已有等待中的指定派獎，請先取消原規則。');
      }

      const rules = dto.stageNumbers.map((stageNumber) => ({
        playerId: player.id,
        player: player,
        businessDate: businessDate,
        stageNumber: stageNumber,
        pendingKey: this.buildPendingKey(player.id, businessDate, stageNumber),
        reason: dto.reason,
        createdByAdminId: adminId
      }));

      return this.awardOverridesRepository.createMany(rules, tx);
    });
  }

  /**
   * 取消今日仍在 pending 的指定派獎規則。
   *
   * @param {string} id
   * @param {string|undefined} adminId
   * @returns {Promise<Object>}
   */
  async cancel(id, adminId) {
    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);
    const rule = await this.awardOverridesRepository.findPendingById(id, businessDate);

    if (!rule) {
      throw HttpError.notFound('找不到今日等待中的指定派獎，可能已被取消或已被抽獎消耗。');
    }

    return this.awardOverridesRepository.cancel(rule, adminId);
  }

  /**
   * 查詢玩家今日指定階段是否有等待中的指定派獎規則。
   *
   * @param {string} playerId
   * @param {string} businessDate
   * @param {number} stageNumber
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Object|null>}
   */
  async findPendingForSpin(playerId, businessDate, stageNumber, tx) {
    return this.awardOverridesRepository.findPendingForSpin(playerId, businessDate, stageNumber, tx);
  }

  /**
   * 真實抽獎成功後，把指定派獎規則標記為 consumed。
   *
   * @param {Object} rule
   * @param {string} spinRecordId
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Object>}
   */
  async consume(rule, spinRecordId, tx) {
    return this.awardOverridesRepository.consume(rule, spinRecordId, tx);
  }

  /**
   * 解析建立類 API 的輸入資料。
   *
   * @param {Object|null|undefined} input
   * @returns {{ playerId: string, stageNumbers: number[], reason: string|undefined }}
   */
  parseCreateInput(input) {
    const messages = [];
    const playerId = input && typeof input.playerId === 'string' ? input.playerId.trim() : '';
    const stageNumbers = input && Array.isArray(input.stageNumbers) ? input.stageNumbers.map(Number).sort(sortNumbers) : [];
    const reason = input && typeof input.reason === 'string' ? input.reason : undefined;

    if (!playerId || playerId.length > 120) {
      messages.push('playerId must be a string shorter than or equal to 120 characters');
    }

    if (!stageNumbers.length || stageNumbers.length > 5) {
      messages.push('stageNumbers must contain between 1 and 5 values');
    }

    if (new Set(stageNumbers).size !== stageNumbers.length) {
      messages.push('指定階段不能重複。');
    }

    stageNumbers.forEach(function (stageNumber) {
      if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > 5) {
        messages.push('指定階段只能是 LV1 到 LV5。');
      }
    });

    if (reason && reason.length > 255) {
      messages.push('reason must be shorter than or equal to 255 characters');
    }

    if (messages.length) {
      throw HttpError.badRequest(messages);
    }

    return {
      playerId: playerId,
      stageNumbers: stageNumbers,
      reason: reason
    };
  }

  /**
   * 檢查指定派獎狀態是否為 pending、consumed 或 cancelled。
   *
   * @param {string} status
   * @returns {string}
   */
  assertStatus(status) {
    if (AWARD_OVERRIDE_STATUSES.indexOf(status) === -1) {
      throw HttpError.badRequest('指定派獎狀態不正確。');
    }

    return status;
  }

  /**
   * 組合 pending 唯一鍵，用來避免同玩家同日同階段重複指定派獎。
   *
   * @param {string} playerId
   * @param {string} businessDate
   * @param {number} stageNumber
   * @returns {string}
   */
  buildPendingKey(playerId, businessDate, stageNumber) {
    return playerId + ':' + businessDate + ':' + stageNumber;
  }

  /**
   * 把階段編號陣列格式化成錯誤訊息可讀的 LV 字串。
   *
   * @param {number[]} stageNumbers
   * @returns {string}
   */
  formatStages(stageNumbers) {
    return stageNumbers.map(function (stageNumber) {
      return 'LV' + stageNumber;
    }).join('、');
  }
}

function sortNumbers(left, right) {
  return left - right;
}

module.exports = AwardOverridesService;
