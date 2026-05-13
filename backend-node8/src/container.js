'use strict';

const db = require('./db');
const AdminUsersRepository = require('./repositories/admin-users-repository');
const AwardOverridesRepository = require('./repositories/award-overrides-repository');
const DemoSessionsRepository = require('./repositories/demo-sessions-repository');
const PlayerDailyProgressRepository = require('./repositories/player-daily-progress-repository');
const PlayersRepository = require('./repositories/players-repository');
const ReportsRepository = require('./repositories/reports-repository');
const SpinRecordsRepository = require('./repositories/spin-records-repository');
const AwardOverridesController = require('./controllers/award-overrides-controller');
const AuthController = require('./controllers/auth-controller');
const DemoController = require('./controllers/demo-controller');
const PlayersController = require('./controllers/players-controller');
const ProbabilityController = require('./controllers/probability-controller');
const ProbabilityImportsController = require('./controllers/probability-imports-controller');
const ReportsController = require('./controllers/reports-controller');
const SimulationsController = require('./controllers/simulations-controller');
const SpinsController = require('./controllers/spins-controller');
const AwardOverridesService = require('./services/award-overrides-service');
const AuthService = require('./services/auth-service');
const DemoTokenService = require('./services/demo-token-service');
const PlayersService = require('./services/players-service');
const ProbabilityImportsService = require('./services/probability-imports-service');
const ProbabilityService = require('./services/probability-service');
const ReportsService = require('./services/reports-service');
const SimulationsService = require('./services/simulations-service');
const SpinsService = require('./services/spins-service');

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
    this.adminUsersRepository = new AdminUsersRepository(this.db);
    this.awardOverridesRepository = new AwardOverridesRepository(this.db);
    this.demoSessionsRepository = new DemoSessionsRepository(this.db);
    this.playersRepository = new PlayersRepository(this.db);
    this.playerDailyProgressRepository = new PlayerDailyProgressRepository(this.db);
    this.reportsRepository = new ReportsRepository(this.db);
    this.spinRecordsRepository = new SpinRecordsRepository(this.db);
    this.probabilityService = new ProbabilityService({
      config: this.config
    });
    this.authService = new AuthService({
      config: this.config,
      adminUsersRepository: this.adminUsersRepository
    });
    this.playersService = new PlayersService({
      config: this.config,
      playersRepository: this.playersRepository,
      playerDailyProgressRepository: this.playerDailyProgressRepository,
      spinRecordsRepository: this.spinRecordsRepository
    });
    this.awardOverridesService = new AwardOverridesService({
      config: this.config,
      db: this.db,
      awardOverridesRepository: this.awardOverridesRepository,
      playersService: this.playersService,
      spinRecordsRepository: this.spinRecordsRepository
    });
    this.demoTokenService = new DemoTokenService({
      config: this.config,
      db: this.db,
      demoSessionsRepository: this.demoSessionsRepository,
      playersService: this.playersService,
      playerDailyProgressRepository: this.playerDailyProgressRepository,
      probabilityService: this.probabilityService
    });
    this.spinsService = new SpinsService({
      config: this.config,
      db: this.db,
      probabilityService: this.probabilityService,
      demoTokenService: this.demoTokenService,
      playerDailyProgressRepository: this.playerDailyProgressRepository,
      spinRecordsRepository: this.spinRecordsRepository,
      awardOverridesService: this.awardOverridesService
    });
    this.reportsService = new ReportsService({
      reportsRepository: this.reportsRepository,
      playersService: this.playersService,
      probabilityService: this.probabilityService
    });
    this.simulationsService = new SimulationsService({
      probabilityService: this.probabilityService
    });
    this.probabilityImportsService = new ProbabilityImportsService({
      config: this.config,
      probabilityService: this.probabilityService
    });
    this.awardOverridesController = new AwardOverridesController(this.awardOverridesService);
    this.authController = new AuthController(this.authService);
    this.demoController = new DemoController(this.demoTokenService);
    this.playersController = new PlayersController(this.playersService);
    this.probabilityController = new ProbabilityController(this.probabilityService);
    this.probabilityImportsController = new ProbabilityImportsController(this.probabilityImportsService);
    this.reportsController = new ReportsController(this.reportsService);
    this.simulationsController = new SimulationsController(this.simulationsService);
    this.spinsController = new SpinsController(this.spinsService);
  }
}

module.exports = Container;
