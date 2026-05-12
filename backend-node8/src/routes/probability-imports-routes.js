'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * Routes for probability XLSX zip import workflows.
 */
class ProbabilityImportsRoutes {
  /**
   * @param {{ container: import('../container'), requireAdmin: Function, upload: Object }} context
   */
  constructor(context) {
    this.probabilityImportsController = context.container.probabilityImportsController;
    this.requireAdmin = context.requireAdmin;
    this.upload = context.upload;
  }

  /**
   * @param {Object} router
   * @returns {void}
   */
  register(router) {
    router.post(
      '/probability/imports/preview',
      this.requireAdmin,
      this.upload.single('file'),
      AsyncHandler.wrap((req, res, next) => this.probabilityImportsController.previewImport(req, res, next))
    );
    router.post(
      '/probability/imports/apply',
      this.requireAdmin,
      AsyncHandler.wrap((req, res, next) => this.probabilityImportsController.applyImport(req, res, next))
    );
    router.get(
      '/probability/imports',
      this.requireAdmin,
      AsyncHandler.wrap((req, res, next) => this.probabilityImportsController.getImports(req, res, next))
    );
    router.post(
      '/probability/imports/:uploadId/download-token',
      this.requireAdmin,
      AsyncHandler.wrap((req, res, next) => this.probabilityImportsController.createDownloadToken(req, res, next))
    );
    router.get(
      '/probability/imports/download/:token',
      AsyncHandler.wrap((req, res, next) => this.probabilityImportsController.downloadImportByToken(req, res, next))
    );
    router.get(
      '/probability/imports/:uploadId/download',
      this.requireAdmin,
      AsyncHandler.wrap((req, res, next) => this.probabilityImportsController.downloadImport(req, res, next))
    );
  }
}

module.exports = ProbabilityImportsRoutes;
