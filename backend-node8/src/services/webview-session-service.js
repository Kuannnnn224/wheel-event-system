'use strict';

const Url = require('url').URL;
const HttpError = require('../utils/http-error');
const time = require('../utils/time');

/**
 * 處理正式 Webview 開頁 URL 與公開玩家狀態。
 */
class WebviewSessionService {
  /**
   * 初始化 webview service。
   *
   * @param {{ config: Object, webviewTokenService: Object, spinRecordsRepository: Object, probabilityService: Object }} options
   */
  constructor(options) {
    this.config = options.config;
    this.webviewTokenService = options.webviewTokenService;
    this.spinRecordsRepository = options.spinRecordsRepository;
    this.probabilityService = options.probabilityService;
  }

  /**
   * 建立正式 Webview URL，App client 呼叫此 API 後把 URL 回給前端開頁。
   *
   * @param {Object|null|undefined} input
   * @param {{ origin?: string, referer?: string }} [context]
   * @returns {Promise<{ player: Object, token: string, issuedAt: number, expiresAt: number, webviewUrl: string }>}
   */
  async createSession(input, context) {
    const dto = this.parseCreateSessionInput(input);
    const signed = this.webviewTokenService.sign(dto);

    return {
      player: this.toPublicPlayer(dto.playerId),
      token: signed.token,
      issuedAt: signed.issuedAt,
      expiresAt: signed.expiresAt,
      webviewUrl: this.buildWebviewUrl(this.resolveWebviewBaseUrl(context || {}), signed.token)
    };
  }

  /**
   * 驗證 token 並回傳玩家上下文。
   *
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async validateToken(token) {
    const payload = this.webviewTokenService.verify(token);

    return {
      id: payload.playerId,
      turnoverPoints: payload.turnoverPoints,
      unlockedStage: payload.unlockedStage,
      tokenIssuedAt: payload.issuedAt,
      tokenExpiresAt: payload.expiresAt
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
   * 回傳 token 對應玩家今日狀態。
   *
   * @param {string} token
   * @returns {Promise<Object>}
   */
  async getSessionState(token) {
    const player = await this.validateToken(token);
    const businessDate = time.resolveCurrentBusinessDate(undefined, this.config.businessTimeZone);
    const spins = await this.spinRecordsRepository.findByPlayerAndDate(player.id, businessDate);

    return {
      player: this.toPublicPlayer(player.id),
      issuedAt: player.tokenIssuedAt,
      expiresAt: player.tokenExpiresAt,
      businessDate: businessDate,
      progress: this.toPublicProgress({
        playerId: player.id,
        businessDate: businessDate,
        turnoverPoints: player.turnoverPoints,
        unlockedStage: player.unlockedStage,
        spins: spins
      })
    };
  }

  /**
   * 解析 App client 建立 Webview URL 的輸入。
   *
   * @param {Object|null|undefined} input
   * @returns {{ playerId: string, turnoverPoints: number, unlockedStage: number }}
   */
  parseCreateSessionInput(input) {
    const errors = [];
    const source = input || {};
    const playerId = typeof source.playerId === 'string' ? source.playerId.trim() : '';
    const turnoverPoints = Number(source.turnoverPoints);
    const unlockedStage = Number(source.unlockedStage);

    if (typeof source.playerId !== 'string') {
      errors.push('playerId must be a string');
    } else if (playerId.length < 1 || playerId.length > 120) {
      errors.push('playerId must be between 1 and 120 characters');
    }

    if (!Number.isInteger(turnoverPoints)) {
      errors.push('turnoverPoints must be an integer number');
    } else if (turnoverPoints < 0) {
      errors.push('turnoverPoints must not be less than 0');
    }

    if (!Number.isInteger(unlockedStage) || unlockedStage < 0 || unlockedStage > 5) {
      errors.push('unlockedStage must be an integer between 0 and 5');
    }

    if (errors.length) {
      throw HttpError.badRequest(errors);
    }

    return {
      playerId: playerId,
      turnoverPoints: turnoverPoints,
      unlockedStage: unlockedStage
    };
  }

  /**
   * 把玩家 ID 包成公開回傳格式。
   *
   * @param {string} playerId
   * @returns {{ id: string }}
   */
  toPublicPlayer(playerId) {
    return {
      id: playerId
    };
  }

  /**
   * 把內部進度資料轉成前端可用格式。
   *
   * @param {{ playerId: string, businessDate: string, turnoverPoints: number, unlockedStage: number, spins: Object[] }} progress
   * @returns {Object}
   */
  toPublicProgress(progress) {
    const spins = progress.spins || [];

    return {
      player: this.toPublicPlayer(progress.playerId),
      businessDate: progress.businessDate,
      turnoverPoints: progress.turnoverPoints,
      unlockedStage: progress.unlockedStage,
      playedStages: spins.map(function (spin) {
        return spin.stageNumber;
      }),
      totalWinPoints: spins.reduce(function (sum, spin) {
        return sum + spin.amountPoints;
      }, 0),
      spins: spins.map(function (spin) {
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
   * @param {{ origin?: string, referer?: string }} context
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
   * @param {{ origin?: string, referer?: string }} context
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
}

function normalizeConfigString(value) {
  return value ? String(value).trim() : '';
}

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
