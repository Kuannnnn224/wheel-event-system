'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * Routes for admin award override rules.
 */
class AwardOverridesRoutes {
  /**
   * @param {{ container: import('../container'), requireAdmin: Function }} context
   */
  constructor(context) {
    this.awardOverridesController = context.container.awardOverridesController;
    this.requireAdmin = context.requireAdmin;
  }

  /**
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.get('/award-overrides', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.awardOverridesController.list(req, res, next)));
    router.post('/award-overrides', this.requireAdmin, AsyncHandler.wrap((req, res, next) => this.awardOverridesController.create(req, res, next)));
    router.patch(
      '/award-overrides/:id/cancel',
      this.requireAdmin,
      AsyncHandler.wrap((req, res, next) => this.awardOverridesController.cancel(req, res, next))
    );
  }
}

module.exports = AwardOverridesRoutes;
