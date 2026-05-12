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
    router.get('/award-overrides', this.requireAdmin, AsyncHandler.wrap(this.awardOverridesController.list));
    router.post('/award-overrides', this.requireAdmin, AsyncHandler.wrap(this.awardOverridesController.create));
    router.patch('/award-overrides/:id/cancel', this.requireAdmin, AsyncHandler.wrap(this.awardOverridesController.cancel));
  }
}

module.exports = AwardOverridesRoutes;
