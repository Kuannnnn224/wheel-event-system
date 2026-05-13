'use strict';

const HttpError = require('../utils/http-error');
const time = require('../utils/time');

/**
 * @typedef {Object} PlayersServiceOptions
 * @property {Object} config
 * @property {import('../repositories/players-repository')} playersRepository
 * @property {import('../repositories/player-daily-progress-repository')} playerDailyProgressRepository
 * @property {import('../repositories/spin-records-repository')} spinRecordsRepository
 */

/**
 * @typedef {Object} DailyProgressResult
 * @property {Object} player
 * @property {string} businessDate
 * @property {number} turnoverPoints
 * @property {number} unlockedStage
 * @property {number[]} playedStages
 * @property {number} totalWinPoints
 * @property {Object[]} spins
 */

/**
 * 處理後控玩家查詢與當日進度彙整。
 */
class PlayersService {
  /**
   * 初始化玩家 service，保存玩家、進度與抽獎紀錄 repository。
   *
   * @param {PlayersServiceOptions} options
   */
  constructor(options) {
    this.config = options.config;
    this.playersRepository = options.playersRepository;
    this.playerDailyProgressRepository = options.playerDailyProgressRepository;
    this.spinRecordsRepository = options.spinRecordsRepository;
  }

  /**
   * 列出玩家清單並限制最大筆數。
   *
   * @param {string|undefined} rawLimit
   * @returns {Promise<Object[]>}
   */
  async listPlayers(rawLimit) {
    const limit = this.parseLimit(rawLimit);
    return this.playersRepository.listPlayers(limit);
  }

  /**
   * 依平台玩家 ID 查詢玩家。
   *
   * @param {string} externalId
   * @returns {Promise<Object|null>}
   */
  async findByExternalId(externalId) {
    return this.playersRepository.findByExternalId(externalId);
  }

  /**
   * 依平台玩家 ID 查詢或建立玩家。
   *
   * @param {string} externalId
   * @param {import('../db').DatabaseConnection} [tx]
   * @returns {Promise<Object>}
   */
  async getOrCreateByExternalId(externalId, tx) {
    return this.playersRepository.getOrCreateByExternalId(externalId, tx);
  }

  /**
   * 依內部玩家 id 查詢玩家。
   *
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const player = await this.playersRepository.findById(id);
    if (!player) {
      throw HttpError.notFound('Player not found.');
    }

    return player;
  }

  /**
   * 取得玩家當日公開進度資料。
   *
   * @param {string} playerId
   * @param {string|undefined} date
   * @returns {Promise<DailyProgressResult>}
   */
  async getDailyProgress(playerId, date) {
    const player = await this.getById(playerId);
    const businessDate = time.resolveCurrentBusinessDate(date, this.config.businessTimeZone);
    const progress = await this.playerDailyProgressRepository.findByPlayerAndDate(playerId, businessDate);
    const spins = await this.spinRecordsRepository.findByPlayerAndDate(playerId, businessDate);

    return {
      player: player,
      businessDate: businessDate,
      turnoverPoints: progress ? progress.turnoverPoints : 0,
      unlockedStage: progress ? progress.unlockedStage : 0,
      playedStages: spins.map(function (spin) {
        return spin.stageNumber;
      }),
      totalWinPoints: spins.reduce(function (sum, spin) {
        return sum + spin.amountPoints;
      }, 0),
      spins: spins
    };
  }

  /**
   * 解析列表 limit，避免過大查詢。
   *
   * @param {string|undefined} rawLimit
   * @returns {number}
   */
  parseLimit(rawLimit) {
    const parsed = rawLimit === undefined ? 50 : Number(rawLimit);
    if (!Number.isFinite(parsed)) {
      return 50;
    }

    return Math.max(Math.min(Math.floor(parsed), 200), 0);
  }
}

module.exports = PlayersService;
