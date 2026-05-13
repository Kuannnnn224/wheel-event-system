'use strict';

const AsyncHandler = require('../utils/async-handler');

/**
 * 機率 XLSX zip 匯入流程相關 routes。
 */
class ProbabilityImportsRoutes {
  /**
   * 初始化機率匯入 routes，保存 route context。
   *
   * @param {{ container: import('../container'), requireAdmin: Function, upload: Object }} context
   */
  constructor(context) {
    this.probabilityImportsController = context.container.probabilityImportsController;
    this.requireAdmin = context.requireAdmin;
    this.upload = context.upload;
  }

  /**
   * 把本模組的 API endpoint 掛到 Express router。
   *
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
