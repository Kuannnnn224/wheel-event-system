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
      AsyncHandler.wrap(this.probabilityImportsController.previewImport)
    );
    router.post('/probability/imports/apply', this.requireAdmin, AsyncHandler.wrap(this.probabilityImportsController.applyImport));
    router.get('/probability/imports', this.requireAdmin, AsyncHandler.wrap(this.probabilityImportsController.getImports));
    router.post(
      '/probability/imports/:uploadId/download-token',
      this.requireAdmin,
      AsyncHandler.wrap(this.probabilityImportsController.createDownloadToken)
    );
    router.get('/probability/imports/download/:token', AsyncHandler.wrap(this.probabilityImportsController.downloadImportByToken));
    router.get('/probability/imports/:uploadId/download', this.requireAdmin, AsyncHandler.wrap(this.probabilityImportsController.downloadImport));
  }
}

module.exports = ProbabilityImportsRoutes;
