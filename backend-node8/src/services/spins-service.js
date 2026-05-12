'use strict';

const spinRules = require('../domain/spin-rules');
const HttpError = require('../utils/http-error');
const time = require('../utils/time');

/**
 * @typedef {Object} SimulateSpinInput
 * @property {number|string} stageNumber
 */

/**
 * Handles spin simulation and later real spin orchestration.
 */
class SpinsService {
  /**
   * @param {Object} options
   * @param {Object} options.config
   * @param {import('../db').Database} options.db
   * @param {import('./probability-service')} options.probabilityService
   * @param {import('./demo-token-service')} options.demoTokenService
   * @param {import('../repositories/player-daily-progress-repository')} options.playerDailyProgressRepository
   * @param {import('../repositories/spin-records-repository')} options.spinRecordsRepository
   * @param {import('./award-overrides-service')} options.awardOverridesService
   */
  constructor(options) {
    this.config = options.config;
    this.db = options.db;
    this.probabilityService = options.probabilityService;
    this.demoTokenService = options.demoTokenService;
    this.playerDailyProgressRepository = options.playerDailyProgressRepository;
    this.spinRecordsRepository = options.spinRecordsRepository;
    this.awardOverridesService = options.awardOverridesService;
  }

  /**
   * @param {SimulateSpinInput} input
   * @returns {Promise<Object>}
   */
  async simulate(input) {
    const stageNumber = this.parseStageNumber(input);
    const draw = await this.probabilityService.drawPrize(stageNumber);

    return {
      stageNumber: stageNumber,
      probabilityTable: draw.table,
      prize: {
        rewardCode: draw.prize.rewardCode,
        name: draw.prize.name,
        amountPoints: draw.prize.amountPoints
      }
    };
  }

  /**
   * @param {{ token: string, stageNumber: number|string }} input
   * @returns {Promise<Object>}
   */
  async realSpin(input) {
    const dto = this.parseRealSpinInput(input);
    const player = await this.demoTokenService.validateToken(dto.token);
    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);

    return this.db.withTransaction(async (tx) => {
      const progress = await this.playerDailyProgressRepository.findByPlayerAndDate(player.id, businessDate, tx);
      const existingSpins = await this.spinRecordsRepository.findByPlayerAndDate(player.id, businessDate, tx);
      const rule = spinRules.validateRealSpinRule({
        requestedStage: dto.stageNumber,
        unlockedStage: progress ? progress.unlockedStage : 0,
        playedStages: existingSpins.map((spin) => spin.stageNumber)
      });

      if (!rule.allowed) {
        throw HttpError.badRequest(rule.reason);
      }

      const overrideRule = await this.awardOverridesService.findPendingForSpin(player.id, businessDate, dto.stageNumber, tx);
      const draw = await this.resolveRealSpinDraw(overrideRule, businessDate, dto.stageNumber, tx);
      const spin = await this.createSpinRecord(player.id, businessDate, dto.stageNumber, draw, tx);

      if (overrideRule) {
        await this.awardOverridesService.consume(overrideRule, spin.id, tx);
      }

      return {
        player: player,
        businessDate: businessDate,
        spin: {
          id: spin.id,
          businessDate: spin.businessDate,
          stageNumber: spin.stageNumber,
          prizeName: spin.prizeName,
          amountPoints: spin.amountPoints,
          createdAt: spin.createdAt
        },
        prize: {
          rewardCode: draw.prize.rewardCode,
          name: draw.prize.name,
          amountPoints: draw.prize.amountPoints
        }
      };
    });
  }

  /**
   * @param {Object|null} overrideRule
   * @param {string} businessDate
   * @param {number} stageNumber
   * @param {import('../db').DatabaseConnection} tx
   * @returns {Promise<Object>}
   */
  async resolveRealSpinDraw(overrideRule, businessDate, stageNumber, tx) {
    if (overrideRule) {
      return this.probabilityService.drawPrizeForTable(stageNumber, 'prize');
    }

    if (await this.shouldUseDailyLimitTable(businessDate, tx)) {
      return this.probabilityService.drawPrizeForTable(stageNumber, 'dailyLimit');
    }

    return this.probabilityService.drawPrize(stageNumber);
  }

  /**
   * @param {string} businessDate
   * @param {import('../db').DatabaseConnection} tx
   * @returns {Promise<boolean>}
   */
  async shouldUseDailyLimitTable(businessDate, tx) {
    const dailyPayoutLimitPoints = await this.probabilityService.getDailyPayoutLimitPoints();

    if (dailyPayoutLimitPoints <= 0) {
      return false;
    }

    const totalAmountPoints = await this.spinRecordsRepository.sumAmountPointsByDate(businessDate, tx);
    return totalAmountPoints >= dailyPayoutLimitPoints;
  }

  /**
   * @param {string} playerId
   * @param {string} businessDate
   * @param {number} stageNumber
   * @param {Object} draw
   * @param {import('../db').DatabaseConnection} tx
   * @returns {Promise<Object>}
   */
  async createSpinRecord(playerId, businessDate, stageNumber, draw, tx) {
    try {
      return await this.spinRecordsRepository.create({
        playerId: playerId,
        businessDate: businessDate,
        stageNumber: stageNumber,
        probabilityTable: draw.table,
        prizeName: draw.prize.name,
        amountPoints: draw.prize.amountPoints
      }, tx);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        throw HttpError.badRequest('Stage was already played for this business date.');
      }

      throw err;
    }
  }

  /**
   * @param {SimulateSpinInput|Object|null|undefined} input
   * @returns {number}
   */
  parseStageNumber(input) {
    const rawValue = input ? input.stageNumber : undefined;
    const stageNumber = Number(rawValue);

    if (!Number.isInteger(stageNumber)) {
      throw HttpError.badRequest(['stageNumber must be an integer number']);
    }

    if (stageNumber < 1) {
      throw HttpError.badRequest(['stageNumber must not be less than 1']);
    }

    if (stageNumber > 5) {
      throw HttpError.badRequest(['stageNumber must not be greater than 5']);
    }

    return stageNumber;
  }

  /**
   * @param {Object|null|undefined} input
   * @returns {{ token: string, stageNumber: number }}
   */
  parseRealSpinInput(input) {
    const token = input && typeof input.token === 'string' ? input.token : '';
    const messages = [];

    if (!token) {
      messages.push('token must be a string');
    }

    let stageNumber = null;
    try {
      stageNumber = this.parseStageNumber(input);
    } catch (err) {
      if (err && err.messages) {
        messages.push.apply(messages, err.messages);
      } else if (err && err.message) {
        messages.push(err.message);
      }
    }

    if (messages.length) {
      throw HttpError.badRequest(messages);
    }

    return {
      token: token,
      stageNumber: stageNumber
    };
  }
}

module.exports = SpinsService;
