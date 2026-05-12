'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * Routes for probability config inspection.
 */
class ProbabilityRoutes {
  /**
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.probabilityController = context.container.probabilityController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.get('/probability/config', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.probabilityController.getConfig(req, res, next)));
    router.get('/probability/stages', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.probabilityController.getStages(req, res, next)));
    router.put('/probability/stages', this.requireAdmin, probabilityStagesForbidden());
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

module.exports = ProbabilityRoutes;
