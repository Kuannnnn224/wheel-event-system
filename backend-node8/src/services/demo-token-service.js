'use strict';

const Url = require('url').URL;
const HttpError = require('../utils/http-error');
const ids = require('../utils/ids');
const time = require('../utils/time');

/**
 * @typedef {Object} DemoTokenServiceOptions
 * @property {Object} config
 * @property {import('../db').Database} db
 * @property {import('../repositories/demo-sessions-repository')} demoSessionsRepository
 * @property {import('../repositories/players-repository')} [playersRepository]
 * @property {import('./players-service')} [playersService]
 * @property {import('./probability-service')} probabilityService
 */

/**
 * @typedef {Object} CreateDemoSessionInput
 * @property {string} externalId
 * @property {number} turnoverPoints
 */

/**
 * @typedef {Object} WebviewUrlContext
 * @property {string|undefined} [origin]
 * @property {string|undefined} [referer]
 */

/**
 * Handles demo token lifecycle and public webview session state.
 */
class DemoTokenService {
  /**
   * @param {DemoTokenServiceOptions} options
   */
  constructor(options) {
    this.config = options.config;
    this.db = options.db || options.demoSessionsRepository.db;
    this.demoSessionsRepository = options.demoSessionsRepository;
    this.playersRepository = options.playersRepository;
    this.playersService = options.playersService;
    this.probabilityService = options.probabilityService;
  }

  /**
   * @param {CreateDemoSessionInput|Object|null|undefined} input
   * @param {WebviewUrlContext} [context]
   * @returns {Promise<{ player: Object, token: string, expiresAt: number, webviewUrl: string }>}
   */
  async createSession(input, context) {
    const dto = this.parseCreateSessionInput(input);
    const player = await this.getOrCreatePlayer(dto.externalId);
    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);
    const stageThresholds = await this.getStageThresholds();
    const token = ids.randomToken();
    const ttlMinutes = Number(this.config.demoTokenTtlMinutes || 30);
    const expiresAt = time.unixTimestampSeconds() + ttlMinutes * 60;

    const session = await this.db.withTransaction(async (tx) => {
      const progress = await this.findDailyProgress(tx, player.id, businessDate);
      const turnoverPoints = Math.max(progress ? progress.turnoverPoints : 0, dto.turnoverPoints);
      const unlockedStage = Math.max(
        progress ? progress.unlockedStage : 0,
        calculateUnlockedStage(turnoverPoints, stageThresholds)
      );

      await this.saveDailyProgressSnapshot(tx, player.id, businessDate, turnoverPoints, unlockedStage);

      return this.demoSessionsRepository.withConnection(tx).create({
        playerId: player.id,
        token: token,
        expiresAt: expiresAt
      });
    });

    return {
      player: player,
      token: session.token,
      expiresAt: session.expiresAt,
      webviewUrl: this.buildWebviewUrl(this.resolveWebviewBaseUrl(context || {}), token)
    };
  }

  /**
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async validateToken(token) {
    const session = await this.findValidSession(token);
    return session.player;
  }

  /**
   * @returns {{ apiBaseUrl: string }}
   */
  getClientConfig() {
    return {
      apiBaseUrl: this.resolveWebviewApiBaseUrl()
    };
  }

  /**
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async getSessionState(token) {
    const session = await this.findValidSession(token);
    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);
    const results = await Promise.all([
      this.getDailyProgress(session.playerId, businessDate),
      this.probabilityService.getStages()
    ]);

    return {
      player: session.player,
      expiresAt: session.expiresAt,
      businessDate: businessDate,
      progress: this.toPublicProgress(results[0]),
      stages: this.toPublicStages(results[1])
    };
  }

  /**
   * @param {CreateDemoSessionInput|Object|null|undefined} input
   * @returns {CreateDemoSessionInput}
   */
  parseCreateSessionInput(input) {
    const errors = [];
    const source = input || {};

    if (typeof source.externalId !== 'string') {
      errors.push('externalId must be a string');
    } else if (source.externalId.length < 1) {
      errors.push('externalId must be longer than or equal to 1 characters');
    }

    if (!Number.isInteger(source.turnoverPoints)) {
      errors.push('turnoverPoints must be an integer number');
    } else if (source.turnoverPoints < 0) {
      errors.push('turnoverPoints must not be less than 0');
    }

    if (errors.length) {
      throw HttpError.badRequest(errors);
    }

    return {
      externalId: source.externalId,
      turnoverPoints: source.turnoverPoints
    };
  }

  /**
   * @param {string} externalId
   * @returns {Promise<Object>}
   */
  async getOrCreatePlayer(externalId) {
    if (this.playersService && typeof this.playersService.getOrCreateByExternalId === 'function') {
      return this.playersService.getOrCreateByExternalId(externalId);
    }

    if (this.playersRepository && typeof this.playersRepository.getOrCreateByExternalId === 'function') {
      return this.playersRepository.getOrCreateByExternalId(externalId);
    }

    throw new Error('DemoTokenService requires player get-or-create support.');
  }

  /**
   * @returns {Promise<Array<{ stageNumber: number, turnoverThresholdPoints: number }>>}
   */
  async getStageThresholds() {
    if (typeof this.probabilityService.getStageThresholds === 'function') {
      return this.probabilityService.getStageThresholds();
    }

    const stages = await this.probabilityService.getStages();
    return stages.map(function (stage) {
      return {
        stageNumber: stage.stageNumber,
        turnoverThresholdPoints: stage.turnoverThresholdPoints
      };
    });
  }

  /**
   * @param {import('../db').DatabaseConnection} db
   * @param {string} playerId
   * @param {string} businessDate
   * @returns {Promise<{ turnoverPoints: number, unlockedStage: number }|null>}
   */
  async findDailyProgress(db, playerId, businessDate) {
    const row = await db.maybeOne(
      [
        'SELECT turnover_points, unlocked_stage',
        'FROM player_daily_progress',
        'WHERE player_id = ? AND business_date = ?',
        'LIMIT 1'
      ].join(' '),
      [playerId, businessDate]
    );

    if (!row) {
      return null;
    }

    return {
      turnoverPoints: row.turnover_points,
      unlockedStage: row.unlocked_stage
    };
  }

  /**
   * @param {import('../db').DatabaseConnection} db
   * @param {string} playerId
   * @param {string} businessDate
   * @param {number} turnoverPoints
   * @param {number} unlockedStage
   * @returns {Promise<void>}
   */
  async saveDailyProgressSnapshot(db, playerId, businessDate, turnoverPoints, unlockedStage) {
    await db.execute(
      [
        'INSERT INTO player_daily_progress',
        '(id, player_id, business_date, turnover_points, unlocked_stage)',
        'VALUES (?, ?, ?, ?, ?)',
        'ON DUPLICATE KEY UPDATE',
        'turnover_points = GREATEST(turnover_points, VALUES(turnover_points)),',
        'unlocked_stage = GREATEST(unlocked_stage, VALUES(unlocked_stage))'
      ].join(' '),
      [ids.pseudoUuid(), playerId, businessDate, turnoverPoints, unlockedStage]
    );
  }

  /**
   * @param {string} playerId
   * @param {string} businessDate
   * @returns {Promise<Object>}
   */
  async getDailyProgress(playerId, businessDate) {
    if (!this.playersService || typeof this.playersService.getDailyProgress !== 'function') {
      throw new Error('DemoTokenService requires PlayersService.getDailyProgress.');
    }

    return this.playersService.getDailyProgress(playerId, businessDate);
  }

  /**
   * @param {Object} progress
   * @returns {Object}
   */
  toPublicProgress(progress) {
    return {
      player: progress.player,
      businessDate: progress.businessDate,
      turnoverPoints: progress.turnoverPoints,
      unlockedStage: progress.unlockedStage,
      playedStages: progress.playedStages,
      totalWinPoints: progress.totalWinPoints,
      spins: progress.spins.map(function (spin) {
        return {
          id: spin.id,
          businessDate: spin.businessDate,
          stageNumber: spin.stageNumber,
          prizeName: spin.prizeName,
          amountPoints: spin.amountPoints,
          createdAt: spin.createdAt
        };
      })
    };
  }

  /**
   * @param {Object[]} stages
   * @returns {Object[]}
   */
  toPublicStages(stages) {
    return stages.map(function (stage) {
      return {
        stageNumber: stage.stageNumber,
        turnoverThresholdPoints: stage.turnoverThresholdPoints,
        prizes: stage.prizes.map(function (prize) {
          return {
            rewardCode: prize.rewardCode,
            name: prize.name,
            amountPoints: prize.amountPoints,
            sortOrder: prize.sortOrder
          };
        })
      };
    });
  }

  /**
   * @param {WebviewUrlContext} context
   * @returns {string}
   */
  resolveWebviewBaseUrl(context) {
    const configuredBaseUrl = normalizeConfigString(this.config.webviewBaseUrl);
    if (configuredBaseUrl) {
      return configuredBaseUrl;
    }

    const requestOrigin = this.resolveRequestOrigin(context);
    if (requestOrigin) {
      return new Url('/webview.html', requestOrigin).toString();
    }

    return 'http://localhost:5173/webview.html';
  }

  /**
   * @returns {string}
   */
  resolveWebviewApiBaseUrl() {
    return normalizeConfigString(this.config.webviewApiBaseUrl) || '/api';
  }

  /**
   * @param {WebviewUrlContext} context
   * @returns {string|undefined}
   */
  resolveRequestOrigin(context) {
    const origin = normalizeOrigin(context.origin);
    if (origin) {
      return origin;
    }

    if (!context.referer) {
      return undefined;
    }

    try {
      return new Url(context.referer).origin;
    } catch (_err) {
      return undefined;
    }
  }

  /**
   * @param {string} baseUrl
   * @param {string} token
   * @returns {string}
   */
  buildWebviewUrl(baseUrl, token) {
    const url = new Url(baseUrl);
    url.searchParams.set('token', token);
    return url.toString();
  }

  /**
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async findValidSession(token) {
    const session = await this.demoSessionsRepository.findByToken(token);
    if (!session) {
      throw HttpError.notFound('Demo session not found.');
    }

    if (session.expiresAt <= time.unixTimestampSeconds()) {
      throw HttpError.unauthorized('Demo session expired.');
    }

    return session;
  }
}

/**
 * @param {number} turnoverPoints
 * @param {Array<{ stageNumber: number, turnoverThresholdPoints: number }>} stages
 * @returns {number}
 */
function calculateUnlockedStage(turnoverPoints, stages) {
  return stages.filter(function (stage) {
    return turnoverPoints >= stage.turnoverThresholdPoints;
  }).reduce(function (highest, stage) {
    return Math.max(highest, stage.stageNumber);
  }, 0);
}

/**
 * @param {string|undefined} value
 * @returns {string}
 */
function normalizeConfigString(value) {
  return value ? String(value).trim() : '';
}

/**
 * @param {string|undefined} origin
 * @returns {string|undefined}
 */
function normalizeOrigin(origin) {
  if (!origin) {
    return undefined;
  }

  try {
    return new Url(origin).origin;
  } catch (_err) {
    return undefined;
  }
}

module.exports = DemoTokenService;
