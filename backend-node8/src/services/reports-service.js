'use strict';

const HttpError = require('../utils/http-error');
const time = require('../utils/time');

/**
 * 處理後控報表查詢需要的資料整理。
 */
class ReportsService {
  /**
   * 初始化報表 service，保存報表與玩家 repository。
   *
   * @param {Object} options
   * @param {import('../repositories/reports-repository')} options.reportsRepository
   * @param {import('./players-service')} options.playersService
   * @param {import('./probability-service')} options.probabilityService
   */
  constructor(options) {
    this.reportsRepository = options.reportsRepository;
    this.playersService = options.playersService;
    this.probabilityService = options.probabilityService;
  }

  /**
   * 產生單日報表。
   *
   * @param {string} date
   * @returns {Promise<Object>}
   */
  async getDailyReport(date) {
    const businessDate = this.assertReportDate(date, 'date');
    const report = await this.getRangeReport(businessDate, businessDate);
    const dailyPayoutLimitPoints = await this.probabilityService.getDailyPayoutLimitPoints();

    return {
      businessDate: businessDate,
      totalSpins: report.totalSpins,
      uniquePlayers: report.uniquePlayers,
      totalAmountPoints: report.totalAmountPoints,
      dailyPayoutLimitPoints: dailyPayoutLimitPoints,
      dailyLimitActive: dailyPayoutLimitPoints > 0 && report.totalAmountPoints >= dailyPayoutLimitPoints,
      byStage: report.byStage
    };
  }

  /**
   * 產生日期區間報表。
   *
   * @param {string} startDate
   * @param {string} endDate
   * @returns {Promise<Object>}
   */
  async getRangeReport(startDate, endDate) {
    const range = this.resolveReportRange(startDate, endDate);
    const spins = await this.reportsRepository.findSpinsBetween(range.startDate, range.endDate);
    const aggregate = this.aggregateSpins(spins);

    return {
      startDate: range.startDate,
      endDate: range.endDate,
      totalSpins: aggregate.totalSpins,
      uniquePlayers: aggregate.uniquePlayers,
      totalAmountPoints: aggregate.totalAmountPoints,
      byStage: aggregate.byStage
    };
  }

  /**
   * 產生指定玩家的區間報表。
   *
   * @param {string} externalId
   * @param {string} startDate
   * @param {string} endDate
   * @returns {Promise<Object>}
   */
  async getPlayerReport(externalId, startDate, endDate) {
    if (!externalId) {
      throw HttpError.badRequest('externalId is required.');
    }

    const range = this.resolveReportRange(startDate, endDate);
    const player = await this.playersService.findByExternalId(externalId);

    if (!player) {
      throw HttpError.notFound('Player not found.');
    }

    const spins = await this.reportsRepository.findSpinsByPlayerBetween(player.id, range.startDate, range.endDate);
    const progress = await this.reportsRepository.findProgressByPlayerBetween(player.id, range.startDate, range.endDate);

    return {
      player: player,
      startDate: range.startDate,
      endDate: range.endDate,
      totalSpins: spins.length,
      totalAmountPoints: spins.reduce(sumAmountPoints, 0),
      progress: progress,
      spins: spins
    };
  }

  /**
   * 彙總抽獎紀錄成報表統計。
   *
   * @param {Object[]} spins
   * @returns {Object}
   */
  aggregateSpins(spins) {
    const byStage = {};
    const playerIds = {};

    spins.forEach(function (spin) {
      playerIds[spin.playerId] = true;

      if (!byStage[spin.stageNumber]) {
        byStage[spin.stageNumber] = {
          stageNumber: spin.stageNumber,
          spinCount: 0,
          totalAmountPoints: 0
        };
      }

      byStage[spin.stageNumber].spinCount += 1;
      byStage[spin.stageNumber].totalAmountPoints += spin.amountPoints;
    });

    return {
      totalSpins: spins.length,
      uniquePlayers: Object.keys(playerIds).length,
      totalAmountPoints: spins.reduce(sumAmountPoints, 0),
      byStage: Object.keys(byStage).map(function (stageNumber) {
        return byStage[stageNumber];
      }).sort(function (left, right) {
        return left.stageNumber - right.stageNumber;
      })
    };
  }

  /**
   * 解析報表起訖日期。
   *
   * @param {string} startDate
   * @param {string} endDate
   * @returns {{ startDate: string, endDate: string }}
   */
  resolveReportRange(startDate, endDate) {
    const normalizedStartDate = this.assertReportDate(startDate, 'startDate');
    const normalizedEndDate = this.assertReportDate(endDate, 'endDate');

    if (normalizedStartDate > normalizedEndDate) {
      throw HttpError.badRequest('startDate must be before or equal to endDate.');
    }

    return {
      startDate: normalizedStartDate,
      endDate: normalizedEndDate
    };
  }

  /**
   * 檢查報表日期格式。
   *
   * @param {string|undefined} value
   * @param {string} fieldName
   * @returns {string}
   */
  assertReportDate(value, fieldName) {
    if (!value) {
      throw HttpError.badRequest(fieldName + ' is required.');
    }

    try {
      return time.assertBusinessDate(value);
    } catch (_err) {
      throw HttpError.badRequest(fieldName + ' must use YYYY-MM-DD.');
    }
  }
}

function sumAmountPoints(sum, spin) {
  return sum + spin.amountPoints;
}

module.exports = ReportsService;
