'use strict';

const util = require('util');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const HttpError = require('../utils/http-error');
const ids = require('../utils/ids');
const time = require('../utils/time');

const hashPassword = util.promisify(bcrypt.hash);
const comparePassword = util.promisify(bcrypt.compare);
const signJwt = util.promisify(jwt.sign);

/**
 * @typedef {import('../repositories/admin-users-repository')} AdminUsersRepository
 */

/**
 * @typedef {Object} AuthServiceOptions
 * @property {Object} config
 * @property {AdminUsersRepository} adminUsersRepository
 */

/**
 * @typedef {Object} LoginInput
 * @property {string} username
 * @property {string} password
 */

/**
 * @typedef {Object} LoginResult
 * @property {string} accessToken
 * @property {{ id: string, username: string }} admin
 */

/**
 * Handles admin identity flows and mirrors the previous auth behavior.
 */
class AuthService {
  /**
   * @param {AuthServiceOptions} options
   */
  constructor(options) {
    this.config = options.config;
    this.adminUsersRepository = options.adminUsersRepository;
  }

  /**
   * Ensures the default admin account exists before the HTTP server starts.
   *
   * @returns {Promise<import('../repositories/admin-users-repository').AdminUser|null>}
   */
  async ensureInitialAdmin() {
    const username = this.config.adminUsername;
    const existing = await this.adminUsersRepository.findByUsername(username);

    if (existing) {
      return existing;
    }

    const now = time.unixTimestampSeconds();
    const admin = {
      id: ids.pseudoUuid(),
      username: username,
      passwordHash: await hashPassword(this.config.adminPassword, 10),
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    try {
      return await this.adminUsersRepository.create(admin);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        return this.adminUsersRepository.findByUsername(username);
      }

      throw err;
    }
  }

  /**
   * @param {LoginInput} input
   * @returns {Promise<LoginResult>}
   */
  async login(input) {
    this.validateLoginInput(input);

    const admin = await this.adminUsersRepository.findActiveByUsername(input.username);
    if (!admin) {
      throw HttpError.unauthorized('Invalid username or password.');
    }

    const passwordMatches = await comparePassword(input.password, admin.passwordHash);
    if (!passwordMatches) {
      throw HttpError.unauthorized('Invalid username or password.');
    }

    const accessToken = await signJwt(
      {
        sub: admin.id,
        username: admin.username
      },
      this.config.jwtSecret,
      {
        expiresIn: this.config.jwtExpiresIn
      }
    );

    return {
      accessToken: accessToken,
      admin: {
        id: admin.id,
        username: admin.username
      }
    };
  }

  /**
   * @param {LoginInput|Object|null|undefined} input
   * @returns {void}
   */
  validateLoginInput(input) {
    const messages = [];

    if (!input || typeof input.username !== 'string') {
      messages.push('username must be a string');
    }

    if (!input || typeof input.password !== 'string' || input.password.length < 1) {
      messages.push('password must be longer than or equal to 1 characters');
    }

    if (messages.length) {
      throw HttpError.badRequest(messages);
    }
  }
}

module.exports = AuthService;
