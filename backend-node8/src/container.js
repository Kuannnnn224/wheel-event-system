'use strict';

const db = require('./db');
const AwardOverridesRepository = require('./repositories/award-overrides-repository');
const SpinRecordsRepository = require('./repositories/spin-records-repository');
const SpinsController = require('./controllers/spins-controller');
const WebviewSessionController = require('./controllers/webview-session-controller');
const AwardOverridesService = require('./services/award-overrides-service');
const ProbabilityService = require('./services/probability-service');
const SpinsService = require('./services/spins-service');
const WebviewTokenService = require('./services/webview-token-service');
const WebviewSessionService = require('./services/webview-session-service');

/**
 * 建立 Express runtime 需要的 class 相依關係圖。
 */
class Container {
  /**
   * 初始化所有 repository、service 與 controller 的相依關係。
   *
   * @param {Object} config
   */
  constructor(config) {
    this.config = config;
    this.db = db;
    this.awardOverridesRepository = new AwardOverridesRepository(this.db);
    this.spinRecordsRepository = new SpinRecordsRepository(this.db);
    this.webviewTokenService = new WebviewTokenService({
      config: this.config
    });
    this.probabilityService = new ProbabilityService({
      config: this.config
    });
    this.awardOverridesService = new AwardOverridesService({
      config: this.config,
      db: this.db,
      awardOverridesRepository: this.awardOverridesRepository,
      spinRecordsRepository: this.spinRecordsRepository
    });
    this.webviewSessionService = new WebviewSessionService({
      config: this.config,
      webviewTokenService: this.webviewTokenService,
      spinRecordsRepository: this.spinRecordsRepository,
      probabilityService: this.probabilityService
    });
    this.spinsService = new SpinsService({
      config: this.config,
      db: this.db,
      probabilityService: this.probabilityService,
      webviewSessionService: this.webviewSessionService,
      spinRecordsRepository: this.spinRecordsRepository,
      awardOverridesService: this.awardOverridesService
    });
    this.spinsController = new SpinsController(this.spinsService);
    this.webviewSessionController = new WebviewSessionController(this.webviewSessionService);
  }
}

module.exports = Container;
