'use strict';

const HttpError = require('../utils/http-error');
const time = require('../utils/time');

const AWARD_OVERRIDE_STATUSES = ['pending', 'consumed', 'cancelled'];

/**
 * Handles admin-created award override rules.
 */
class AwardOverridesService {
  /**
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
   * @param {string|undefined} status
   * @param {string|undefined} externalId
   * @returns {Promise<Object[]>}
   */
  async list(status, externalId) {
    const normalizedStatus = status && status !== 'all' ? this.assertStatus(status) : undefined;
    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);
    let playerId;

    if (externalId) {
      const player = await this.playersService.findByExternalId(externalId);
      if (!player) {
        return [];
      }

      playerId = player.id;
    }

    return this.awardOverridesRepository.list({
      businessDate: businessDate,
      status: normalizedStatus,
      playerId: playerId
    });
  }

  /**
   * @param {Object} input
   * @param {string|undefined} adminId
   * @returns {Promise<Object[]>}
   */
  async create(input, adminId) {
    const dto = this.parseCreateInput(input);
    const player = await this.playersService.findByExternalId(dto.externalId);

    if (!player) {
      throw HttpError.notFound('找不到玩家，請先建立玩家後再新增指定派獎。');
    }

    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);

    return this.db.withTransaction(async function (tx) {
      const existingSpins = await this.spinRecordsRepository.findByPlayerDateAndStages(player.id, businessDate, dto.stageNumbers, tx);

      if (existingSpins.length > 0) {
        const playedStages = existingSpins.map(function (spin) {
          return spin.stageNumber;
        }).sort(sortNumbers);
        throw HttpError.badRequest('玩家 ' + player.externalId + ' 今天 ' + this.formatStages(playedStages) + ' 已經抽過，該階段轉盤次數已用盡，不能新增指定派獎。');
      }

      const pendingKeys = dto.stageNumbers.map(function (stageNumber) {
        return this.buildPendingKey(player.id, businessDate, stageNumber);
      }, this);
      const existingRules = await this.awardOverridesRepository.findByPendingKeys(pendingKeys, tx);

      if (existingRules.length > 0) {
        const duplicatedStages = existingRules.map(function (rule) {
          return rule.stageNumber;
        }).sort(sortNumbers);
        throw HttpError.badRequest('玩家 ' + player.externalId + ' 今天 ' + this.formatStages(duplicatedStages) + ' 已有等待中的指定派獎，請先取消原規則。');
      }

      const rules = dto.stageNumbers.map(function (stageNumber) {
        return {
          playerId: player.id,
          player: player,
          businessDate: businessDate,
          stageNumber: stageNumber,
          pendingKey: this.buildPendingKey(player.id, businessDate, stageNumber),
          reason: dto.reason,
          createdByAdminId: adminId
        };
      }, this);

      return this.awardOverridesRepository.createMany(rules, tx);
    }.bind(this));
  }

  /**
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
   * @param {Object} rule
   * @param {string} spinRecordId
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Object>}
   */
  async consume(rule, spinRecordId, tx) {
    return this.awardOverridesRepository.consume(rule, spinRecordId, tx);
  }

  /**
   * @param {Object|null|undefined} input
   * @returns {{ externalId: string, stageNumbers: number[], reason: string|undefined }}
   */
  parseCreateInput(input) {
    const messages = [];
    const externalId = input && typeof input.externalId === 'string' ? input.externalId : '';
    const stageNumbers = input && Array.isArray(input.stageNumbers) ? input.stageNumbers.map(Number).sort(sortNumbers) : [];
    const reason = input && typeof input.reason === 'string' ? input.reason : undefined;

    if (!externalId || externalId.length > 120) {
      messages.push('externalId must be a string shorter than or equal to 120 characters');
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
      externalId: externalId,
      stageNumbers: stageNumbers,
      reason: reason
    };
  }

  /**
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
   * @param {string} playerId
   * @param {string} businessDate
   * @param {number} stageNumber
   * @returns {string}
   */
  buildPendingKey(playerId, businessDate, stageNumber) {
    return playerId + ':' + businessDate + ':' + stageNumber;
  }

  /**
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
