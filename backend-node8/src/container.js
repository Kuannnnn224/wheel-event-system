'use strict';

const db = require('./db');
const AdminUsersRepository = require('./repositories/admin-users-repository');
const AuthController = require('./controllers/auth-controller');
const AuthService = require('./services/auth-service');

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
    this.authService = new AuthService({
      config: this.config,
      adminUsersRepository: this.adminUsersRepository
    });
    this.authController = new AuthController(this.authService);
  }
}

module.exports = Container;
