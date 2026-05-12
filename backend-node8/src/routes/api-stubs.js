'use strict';

const auth = require('../middleware/auth');
const requirePlatformApiKey = require('../middleware/platform-api-key');

const ROUTES = [
  { method: 'post', path: '/auth/login', name: 'auth.login', public: true },

  { method: 'get', path: '/players', name: 'players.search' },
  { method: 'get', path: '/players/:id/daily-progress', name: 'players.dailyProgress' },

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

  { method: 'post', path: '/spins/simulate', name: 'spins.simulate' },
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

function registerApiStubs(router, options) {
  const config = options.config;
  const requireAdmin = auth.requireAdmin(config);
  const requireKey = requirePlatformApiKey(config);

  ROUTES.forEach(function (route) {
    const handlers = [];

    if (!route.public) {
      handlers.push(requireAdmin);
    }

    if (route.platformApiKey) {
      handlers.push(requireKey);
    }

    handlers.push(route.handler ? route.handler(config, route) : notImplemented(route));
    router[route.method].apply(router, [route.path].concat(handlers));
  });
}

function notImplemented(route) {
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

function demoClientConfig(config) {
  return function (_req, res) {
    res.json({ apiBaseUrl: config.webviewApiBaseUrl });
  };
}

function probabilityStagesForbidden() {
  return function (_req, res) {
    res.status(403).json({ message: 'Probability settings are managed by XLSX import.' });
  };
}

registerApiStubs.ROUTES = ROUTES;

module.exports = registerApiStubs;
