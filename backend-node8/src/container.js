'use strict';

const db = require('./db');
const AdminUsersRepository = require('./repositories/admin-users-repository');
const PlayerDailyProgressRepository = require('./repositories/player-daily-progress-repository');
const PlayersRepository = require('./repositories/players-repository');
const SpinRecordsRepository = require('./repositories/spin-records-repository');
const AuthController = require('./controllers/auth-controller');
const PlayersController = require('./controllers/players-controller');
const AuthService = require('./services/auth-service');
const PlayersService = require('./services/players-service');

/**
 * Builds the class graph used by the Express runtime.
 */
class Container {
  /**
   * @param {Object} config
   */
  constructor(config) {
    this.config = config;
    this.db = db;
    this.adminUsersRepository = new AdminUsersRepository(this.db);
    this.playersRepository = new PlayersRepository(this.db);
    this.playerDailyProgressRepository = new PlayerDailyProgressRepository(this.db);
    this.spinRecordsRepository = new SpinRecordsRepository(this.db);
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
    this.authController = new AuthController(this.authService);
    this.playersController = new PlayersController(this.playersService);
  }
}

module.exports = Container;
