'use strict';

const auth = require('../middleware/auth');
const requirePlatformApiKey = require('../middleware/platform-api-key');
const AsyncHandler = require('../utils/async-handler');

/**
 * @typedef {Object} RouteDefinition
 * @property {'get'|'post'|'put'|'patch'} method
 * @property {string} path
 * @property {string} name
 * @property {boolean} [public]
 * @property {boolean} [platformApiKey]
 * @property {string} [handlerName]
 * @property {(config: Object, route: RouteDefinition) => Function} [handler]
 */

/**
 * @typedef {Object} ApiStubRoutesOptions
 * @property {Object} config
 * @property {import('../container')} container
 */

/** @type {RouteDefinition[]} */
const ROUTES = [
  { method: 'post', path: '/auth/login', name: 'auth.login', public: true, handlerName: 'authLogin' },

  { method: 'get', path: '/players', name: 'players.search', handlerName: 'playersSearch' },
  { method: 'get', path: '/players/:id/daily-progress', name: 'players.dailyProgress', handlerName: 'playersDailyProgress' },

  { method: 'get', path: '/probability/config', name: 'probability.config' },
  { method: 'get', path: '/probability/stages', name: 'probability.stages' },
  { method: 'put', path: '/probability/stages', name: 'probability.stages.update', handler: probabilityStagesForbidden },

  { method: 'post', path: '/probability/imports/preview', name: 'probabilityImports.preview' },
  { method: 'post', path: '/probability/imports/apply', name: 'probabilityImports.apply' },
  { method: 'get', path: '/probability/imports', name: 'probabilityImports.list' },
  { method: 'post', path: '/probability/imports/:uploadId/download-token', name: 'probabilityImports.downloadToken' },
  { method: 'get', path: '/probability/imports/download/:token', name: 'probabilityImports.publicDownload', public: true },
  { method: 'get', path: '/probability/imports/:uploadId/download', name: 'probabilityImports.legacyDownload' },

  { method: 'get', path: '/award-overrides', name: 'awardOverrides.list' },
  { method: 'post', path: '/award-overrides', name: 'awardOverrides.create' },
  { method: 'patch', path: '/award-overrides/:id/cancel', name: 'awardOverrides.cancel' },

  { method: 'post', path: '/spins/simulate', name: 'spins.simulate', handlerName: 'spinsSimulate' },
  { method: 'post', path: '/spins/real', name: 'spins.real', public: true },

  { method: 'post', path: '/demo/session', name: 'demo.session.create', public: true, platformApiKey: true },
  { method: 'post', path: '/demo/admin-session', name: 'demo.session.adminCreate' },
  { method: 'get', path: '/demo/client-config', name: 'demo.clientConfig', public: true, handler: demoClientConfig },
  { method: 'get', path: '/demo/session', name: 'demo.session.state', public: true },

  { method: 'get', path: '/reports/daily', name: 'reports.daily' },
  { method: 'get', path: '/reports/range', name: 'reports.range' },
  { method: 'get', path: '/reports/player', name: 'reports.player' },

  { method: 'post', path: '/simulations', name: 'simulations.create' },
  { method: 'get', path: '/simulations/:id', name: 'simulations.get' }
];

/**
 * Registers the current API surface while individual modules are migrated.
 */
class ApiStubRoutes {
  /**
   * @param {ApiStubRoutesOptions} options
   */
  constructor(options) {
    this.config = options.config;
    this.container = options.container;
    this.requireAdmin = auth.requireAdmin(this.config);
    this.requireKey = requirePlatformApiKey(this.config);
  }

  /**
   * @param {{ [method: string]: Function }} router
   * @returns {void}
   */
  register(router) {
    ROUTES.forEach(function (route) {
      this.registerRoute(router, route);
    }, this);
  }

  /**
   * @param {{ [method: string]: Function }} router
   * @param {RouteDefinition} route
   * @returns {void}
   */
  registerRoute(router, route) {
    const handlers = [];

    if (!route.public) {
      handlers.push(this.requireAdmin);
    }

    if (route.platformApiKey) {
      handlers.push(this.requireKey);
    }

    handlers.push(this.resolveHandler(route));
    router[route.method].apply(router, [route.path].concat(handlers));
  }

  /**
   * @param {RouteDefinition} route
   * @returns {Function}
   */
  resolveHandler(route) {
    if (route.handlerName === 'authLogin') {
      return AsyncHandler.wrap(this.container.authController.login);
    }

    if (route.handlerName === 'playersSearch') {
      return AsyncHandler.wrap(this.container.playersController.search);
    }

    if (route.handlerName === 'playersDailyProgress') {
      return AsyncHandler.wrap(this.container.playersController.getDailyProgress);
    }

    if (route.handlerName === 'spinsSimulate') {
      return AsyncHandler.wrap(this.container.spinsController.simulate);
    }

    if (route.handler) {
      return route.handler(this.config, route);
    }

    return this.notImplemented(route);
  }

  /**
   * @param {RouteDefinition} route
   * @returns {Function}
   */
  notImplemented(route) {
    return function (_req, res) {
      res.status(501).json({
        message: 'Node 8 backend skeleton route is not implemented yet.',
        route: {
          name: route.name,
          method: route.method.toUpperCase(),
          path: route.path,
          public: !!route.public,
          platformApiKey: !!route.platformApiKey
        }
      });
    };
  }
}

/**
 * @param {Object} config
 * @returns {Function}
 */
function demoClientConfig(config) {
  return function (_req, res) {
    res.json({ apiBaseUrl: config.webviewApiBaseUrl });
  };
}

/**
 * @returns {Function}
 */
function probabilityStagesForbidden() {
  return function (_req, res) {
    res.status(403).json({ message: 'Probability settings are managed by XLSX import.' });
  };
}

ApiStubRoutes.ROUTES = ROUTES;

module.exports = ApiStubRoutes;
