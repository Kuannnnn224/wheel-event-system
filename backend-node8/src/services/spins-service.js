'use strict';

const spinRules = require('../domain/spin-rules');
const HttpError = require('../utils/http-error');
const time = require('../utils/time');

/**
 * 處理真實抽獎的主要流程編排。
 */
class SpinsService {
  /**
   * 初始化抽獎 service，保存抽獎流程需要的 service 與 repository。
   *
   * @param {Object} options
 * @param {Object} options.config
 * @param {import('../db').Database} options.db
 * @param {import('./probability-service')} options.probabilityService
 * @param {import('./webview-session-service')} options.webviewSessionService
   * @param {import('../repositories/spin-records-repository')} options.spinRecordsRepository
   * @param {import('./award-overrides-service')} options.awardOverridesService
   */
  constructor(options) {
    this.config = options.config;
    this.db = options.db;
    this.probabilityService = options.probabilityService;
    this.webviewSessionService = options.webviewSessionService;
    this.spinRecordsRepository = options.spinRecordsRepository;
    this.awardOverridesService = options.awardOverridesService;
  }

  /**
   * 執行真實抽獎流程，包含 token、進度、重複抽與交易寫入。
   *
   * @param {{ token: string, stageNumber: number|string }} input
   * @returns {Promise<Object>}
   */
  async realSpin(input) {
    const dto = this.parseRealSpinInput(input);
    const player = await this.webviewSessionService.validateToken(dto.token);
    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);

    return this.db.withTransaction(async (tx) => {
      const existingSpins = await this.spinRecordsRepository.findByPlayerAndDate(player.id, businessDate, tx);
      const rule = spinRules.validateRealSpinRule({
        requestedStage: dto.stageNumber,
        unlockedStage: player.unlockedStage,
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
        player: {
          id: player.id,
          turnoverPoints: player.turnoverPoints,
          unlockedStage: player.unlockedStage
        },
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
   * 依指定派獎、每日上限與一般機率決定本次抽獎來源。
   *
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
   * 判斷當日累計派獎是否已達每日上限。
   *
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
   * 建立真實抽獎紀錄，並把重複抽獎轉成 API 錯誤。
   *
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
   * 解析 API 傳入的 stageNumber，限制只能是 LV1 到 LV5。
   *
   * @param {Object|null|undefined} input
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
   * 解析 webview 真實抽獎輸入，集中回報驗證錯誤。
   *
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
