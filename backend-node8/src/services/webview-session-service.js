'use strict';

const Url = require('url').URL;
const HttpError = require('../utils/http-error');
const ids = require('../utils/ids');
const time = require('../utils/time');

/**
 * @typedef {Object} WebviewSessionServiceOptions
 * @property {Object} config
 * @property {import('../db').Database} db
 * @property {import('../repositories/webview-sessions-repository')} webviewSessionsRepository
 * @property {import('../repositories/players-repository')} [playersRepository]
 * @property {import('./players-service')} [playersService]
 * @property {import('./probability-service')} probabilityService
 */

/**
 * @typedef {Object} CreateWebviewSessionInput
 * @property {string} playerId
 * @property {number} turnoverPoints
 */

/**
 * @typedef {Object} WebviewUrlContext
 * @property {string|undefined} [origin]
 * @property {string|undefined} [referer]
 */

/**
 * 處理正式 webview session 生命週期與公開 webview 狀態。
 */
class WebviewSessionService {
  /**
   * 初始化 webview session service，保存設定、DB 與 session/player 相依。
   *
   * @param {WebviewSessionServiceOptions} options
   */
  constructor(options) {
    this.config = options.config;
    this.db = options.db || options.webviewSessionsRepository.db;
    this.webviewSessionsRepository = options.webviewSessionsRepository;
    this.playersRepository = options.playersRepository;
    this.playersService = options.playersService;
    this.probabilityService = options.probabilityService;
  }

  /**
   * 建立正式 webview session、更新玩家進度並回傳 webview URL。
   *
   * @param {CreateWebviewSessionInput|Object|null|undefined} input
   * @param {WebviewUrlContext} [context]
   * @returns {Promise<{ player: Object, token: string, expiresAt: number, webviewUrl: string }>}
   */
  async createSession(input, context) {
    const dto = this.parseCreateSessionInput(input);
    const player = await this.getOrCreatePlayer(dto.playerId);
    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);
    const stageThresholds = await this.getStageThresholds();
    const token = ids.randomToken();
    const ttlMinutes = Number(this.config.webviewSessionTtlMinutes || 30);
    const expiresAt = time.unixTimestampSeconds() + ttlMinutes * 60;

    const session = await this.db.withTransaction(async (tx) => {
      const progress = await this.findDailyProgress(tx, player.id, businessDate);
      const turnoverPoints = Math.max(progress ? progress.turnoverPoints : 0, dto.turnoverPoints);
      const unlockedStage = Math.max(
        progress ? progress.unlockedStage : 0,
        calculateUnlockedStage(turnoverPoints, stageThresholds)
      );

      await this.saveDailyProgressSnapshot(tx, player.id, businessDate, turnoverPoints, unlockedStage);

      return this.webviewSessionsRepository.withConnection(tx).create({
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
   * 驗證 webview session token 是否存在且未過期。
   *
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async validateToken(token) {
    const session = await this.findValidSession(token);
    return session.player;
  }

  /**
   * 回傳 webview 前端可公開讀取的 API 設定。
   *
   * @returns {{ apiBaseUrl: string }}
   */
  getClientConfig() {
    return {
      apiBaseUrl: this.resolveWebviewApiBaseUrl()
    };
  }

  /**
   * 回傳 webview 轉盤渲染需要的靜態遊戲設定。
   *
   * @returns {Promise<{ stages: Object[] }>}
   */
  async getGameConfig() {
    const stages = await this.probabilityService.getStages();
    return {
      stages: this.toPublicStages(stages)
    };
  }

  /**
   * 回傳 webview session token 對應的玩家與進度狀態，不包含靜態遊戲設定。
   *
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async getSessionState(token) {
    const session = await this.findValidSession(token);
    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);
    const progress = await this.getDailyProgress(session.playerId, businessDate);

    return {
      player: session.player,
      expiresAt: session.expiresAt,
      businessDate: businessDate,
      progress: this.toPublicProgress(progress)
    };
  }

  /**
   * 解析 app 建立 webview session 的輸入資料。
   *
   * @param {CreateWebviewSessionInput|Object|null|undefined} input
   * @returns {CreateWebviewSessionInput}
   */
  parseCreateSessionInput(input) {
    const errors = [];
    const source = input || {};
    const playerId = typeof source.playerId === 'string' ? source.playerId.trim() : '';

    if (typeof source.playerId !== 'string') {
      errors.push('playerId must be a string');
    } else if (playerId.length < 1 || playerId.length > 120) {
      errors.push('playerId must be between 1 and 120 characters');
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
      playerId: playerId,
      turnoverPoints: source.turnoverPoints
    };
  }

  /**
   * 依平台玩家 ID 查詢玩家，沒有時建立新玩家。
   *
   * @param {string} playerId
   * @returns {Promise<Object>}
   */
  async getOrCreatePlayer(playerId) {
    if (this.playersService && typeof this.playersService.getOrCreateByPlayerId === 'function') {
      return this.playersService.getOrCreateByPlayerId(playerId);
    }

    if (this.playersRepository && typeof this.playersRepository.getOrCreateByPlayerId === 'function') {
      return this.playersRepository.getOrCreateByPlayerId(playerId);
    }

    throw new Error('WebviewSessionService requires player get-or-create support.');
  }

  /**
   * 取得各階段流水門檻，供 webview 顯示進度。
   *
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
   * 查詢玩家指定業務日期的進度快照。
   *
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
   * 寫入或提高玩家當日流水與解鎖階段。
   *
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
   * 取得玩家當日公開進度資料。
   *
   * @param {string} playerId
   * @param {string} businessDate
   * @returns {Promise<Object>}
   */
  async getDailyProgress(playerId, businessDate) {
    if (!this.playersService || typeof this.playersService.getDailyProgress !== 'function') {
      throw new Error('WebviewSessionService requires PlayersService.getDailyProgress.');
    }

    return this.playersService.getDailyProgress(playerId, businessDate);
  }

  /**
   * 把內部進度資料轉成前端可用格式。
   *
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
   * 把階段設定轉成 webview 可顯示格式。
   *
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
   * 決定產生 webview URL 時使用的 base URL。
   *
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
   * 決定 webview 呼叫 API 時使用的 base URL。
   *
   * @returns {string}
   */
  resolveWebviewApiBaseUrl() {
    return normalizeConfigString(this.config.webviewApiBaseUrl) || '/api';
  }

  /**
   * 從 request context 推出目前請求來源。
   *
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
   * 把 base URL 與 token 組成完整 webview 連結。
   *
   * @param {string} baseUrl
   * @param {string} token
   * @returns {string}
   */
  buildWebviewUrl(baseUrl, token) {
    const url = new Url(baseUrl);
    const apiBaseUrl = this.resolveWebviewApiBaseUrl();

    if (!url.searchParams.has('apiBase') && isHttpUrl(apiBaseUrl)) {
      url.searchParams.set('apiBase', apiBaseUrl);
    }

    url.searchParams.set('token', token);
    return url.toString();
  }

  /**
   * 查詢 token session 並確認尚未過期。
   *
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async findValidSession(token) {
    const session = await this.webviewSessionsRepository.findByToken(token);
    if (!session) {
      throw HttpError.notFound('Webview session not found.');
    }

    if (session.expiresAt <= time.unixTimestampSeconds()) {
      throw HttpError.unauthorized('Webview session expired.');
    }

    return session;
  }
}

/**
 * 依流水點數計算玩家目前解鎖到哪個階段。
 *
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
 * 整理設定字串，將 undefined 或空白值轉成空字串。
 *
 * @param {string|undefined} value
 * @returns {string}
 */
function normalizeConfigString(value) {
  return value ? String(value).trim() : '';
}

/**
 * 解析並正規化 origin，只保留協定、網域與 port。
 *
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

/**
 * 判斷設定值是否為可公開給 webview 使用的 HTTP(S) URL。
 *
 * @param {string} value
 * @returns {boolean}
 */
function isHttpUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new Url(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_err) {
    return false;
  }
}

module.exports = WebviewSessionService;
