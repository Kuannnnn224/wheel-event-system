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
 * Handles admin player lookup and current-day progress aggregation.
 */
class PlayersService {
  /**
   * @param {PlayersServiceOptions} options
   */
  constructor(options) {
    this.config = options.config;
    this.playersRepository = options.playersRepository;
    this.playerDailyProgressRepository = options.playerDailyProgressRepository;
    this.spinRecordsRepository = options.spinRecordsRepository;
  }

  /**
   * @param {string|undefined} rawLimit
   * @returns {Promise<Object[]>}
   */
  async listPlayers(rawLimit) {
    const limit = this.parseLimit(rawLimit);
    return this.playersRepository.listPlayers(limit);
  }

  /**
   * @param {string} externalId
   * @returns {Promise<Object|null>}
   */
  async findByExternalId(externalId) {
    return this.playersRepository.findByExternalId(externalId);
  }

  /**
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
