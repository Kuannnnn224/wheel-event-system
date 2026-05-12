'use strict';

const multer = require('multer');
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
 * @property {string} [uploadField]
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

  { method: 'get', path: '/probability/config', name: 'probability.config', handlerName: 'probabilityConfig' },
  { method: 'get', path: '/probability/stages', name: 'probability.stages', handlerName: 'probabilityStages' },
  { method: 'put', path: '/probability/stages', name: 'probability.stages.update', handler: probabilityStagesForbidden },

  { method: 'post', path: '/probability/imports/preview', name: 'probabilityImports.preview', handlerName: 'probabilityImportsPreview', uploadField: 'file' },
  { method: 'post', path: '/probability/imports/apply', name: 'probabilityImports.apply', handlerName: 'probabilityImportsApply' },
  { method: 'get', path: '/probability/imports', name: 'probabilityImports.list', handlerName: 'probabilityImportsList' },
  { method: 'post', path: '/probability/imports/:uploadId/download-token', name: 'probabilityImports.downloadToken', handlerName: 'probabilityImportsDownloadToken' },
  { method: 'get', path: '/probability/imports/download/:token', name: 'probabilityImports.publicDownload', public: true, handlerName: 'probabilityImportsPublicDownload' },
  { method: 'get', path: '/probability/imports/:uploadId/download', name: 'probabilityImports.legacyDownload', handlerName: 'probabilityImportsLegacyDownload' },

  { method: 'get', path: '/award-overrides', name: 'awardOverrides.list', handlerName: 'awardOverridesList' },
  { method: 'post', path: '/award-overrides', name: 'awardOverrides.create', handlerName: 'awardOverridesCreate' },
  { method: 'patch', path: '/award-overrides/:id/cancel', name: 'awardOverrides.cancel', handlerName: 'awardOverridesCancel' },

  { method: 'post', path: '/spins/simulate', name: 'spins.simulate', handlerName: 'spinsSimulate' },
  { method: 'post', path: '/spins/real', name: 'spins.real', public: true, handlerName: 'spinsReal' },

  { method: 'post', path: '/demo/session', name: 'demo.session.create', public: true, platformApiKey: true, handlerName: 'demoCreateSession' },
  { method: 'post', path: '/demo/admin-session', name: 'demo.session.adminCreate', handlerName: 'demoCreateAdminSession' },
  { method: 'get', path: '/demo/client-config', name: 'demo.clientConfig', public: true, handlerName: 'demoClientConfig' },
  { method: 'get', path: '/demo/session', name: 'demo.session.state', public: true, handlerName: 'demoSessionState' },

  { method: 'get', path: '/reports/daily', name: 'reports.daily', handlerName: 'reportsDaily' },
  { method: 'get', path: '/reports/range', name: 'reports.range', handlerName: 'reportsRange' },
  { method: 'get', path: '/reports/player', name: 'reports.player', handlerName: 'reportsPlayer' },

  { method: 'post', path: '/simulations', name: 'simulations.create', handlerName: 'simulationsCreate' },
  { method: 'get', path: '/simulations/:id', name: 'simulations.get', handlerName: 'simulationsGet' }
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
    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024
      }
    });
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

    if (route.uploadField) {
      handlers.push(this.upload.single(route.uploadField));
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

    if (route.handlerName === 'probabilityConfig') {
      return AsyncHandler.wrap(this.container.probabilityController.getConfig);
    }

    if (route.handlerName === 'probabilityStages') {
      return AsyncHandler.wrap(this.container.probabilityController.getStages);
    }

    if (route.handlerName === 'probabilityImportsPreview') {
      return AsyncHandler.wrap(this.container.probabilityImportsController.previewImport);
    }

    if (route.handlerName === 'probabilityImportsApply') {
      return AsyncHandler.wrap(this.container.probabilityImportsController.applyImport);
    }

    if (route.handlerName === 'probabilityImportsList') {
      return AsyncHandler.wrap(this.container.probabilityImportsController.getImports);
    }

    if (route.handlerName === 'probabilityImportsDownloadToken') {
      return AsyncHandler.wrap(this.container.probabilityImportsController.createDownloadToken);
    }

    if (route.handlerName === 'probabilityImportsPublicDownload') {
      return AsyncHandler.wrap(this.container.probabilityImportsController.downloadImportByToken);
    }

    if (route.handlerName === 'probabilityImportsLegacyDownload') {
      return AsyncHandler.wrap(this.container.probabilityImportsController.downloadImport);
    }

    if (route.handlerName === 'awardOverridesList') {
      return AsyncHandler.wrap(this.container.awardOverridesController.list);
    }

    if (route.handlerName === 'awardOverridesCreate') {
      return AsyncHandler.wrap(this.container.awardOverridesController.create);
    }

    if (route.handlerName === 'awardOverridesCancel') {
      return AsyncHandler.wrap(this.container.awardOverridesController.cancel);
    }

    if (route.handlerName === 'spinsSimulate') {
      return AsyncHandler.wrap(this.container.spinsController.simulate);
    }

    if (route.handlerName === 'spinsReal') {
      return AsyncHandler.wrap(this.container.spinsController.realSpin);
    }

    if (route.handlerName === 'demoCreateSession') {
      return AsyncHandler.wrap(this.container.demoController.createSession);
    }

    if (route.handlerName === 'demoCreateAdminSession') {
      return AsyncHandler.wrap(this.container.demoController.createAdminSession);
    }

    if (route.handlerName === 'demoClientConfig') {
      return AsyncHandler.wrap(this.container.demoController.getClientConfig);
    }

    if (route.handlerName === 'demoSessionState') {
      return AsyncHandler.wrap(this.container.demoController.getSession);
    }

    if (route.handlerName === 'reportsDaily') {
      return AsyncHandler.wrap(this.container.reportsController.getDaily);
    }

    if (route.handlerName === 'reportsRange') {
      return AsyncHandler.wrap(this.container.reportsController.getRange);
    }

    if (route.handlerName === 'reportsPlayer') {
      return AsyncHandler.wrap(this.container.reportsController.getPlayer);
    }

    if (route.handlerName === 'simulationsCreate') {
      return AsyncHandler.wrap(this.container.simulationsController.create);
    }

    if (route.handlerName === 'simulationsGet') {
      return AsyncHandler.wrap(this.container.simulationsController.get);
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
 * @returns {Function}
 */
function probabilityStagesForbidden() {
  return function (_req, res) {
    res.status(403).json({ message: '機率設定只能透過機率表 ZIP 匯入，不允許手動更新。' });
  };
}

ApiStubRoutes.ROUTES = ROUTES;

module.exports = ApiStubRoutes;
