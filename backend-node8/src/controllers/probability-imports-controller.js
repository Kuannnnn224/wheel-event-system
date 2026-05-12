'use strict';

const path = require('path');
const HttpError = require('../utils/http-error');

/**
 * Express controller for probability XLSX zip imports.
 */
class ProbabilityImportsController {
  /**
   * @param {import('../services/probability-imports-service')} probabilityImportsService
   */
  constructor(probabilityImportsService) {
    this.probabilityImportsService = probabilityImportsService;
  }

  /**
   * @param {{ file?: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async previewImport(req, res) {
    if (!req.file) {
      throw HttpError.badRequest('Probability zip file is required.');
    }

    res.json(await this.probabilityImportsService.previewImportZip(req.file));
  }

  /**
   * @param {{ body?: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async applyImport(req, res) {
    res.json(await this.probabilityImportsService.applyImportUpload(req.body ? req.body.uploadId : ''));
  }

  /**
   * @param {Object} _req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getImports(_req, res) {
    res.json(await this.probabilityImportsService.listImportUploads());
  }

  /**
   * @param {{ params: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async createDownloadToken(req, res) {
    res.json(await this.probabilityImportsService.createDownloadToken(req.params.uploadId));
  }

  /**
   * @param {{ params: Object }} req
   * @param {Object} res
   * @returns {Promise<void>}
   */
  async downloadImportByToken(req, res) {
    const file = await this.probabilityImportsService.getImportFileByDownloadToken(req.params.token);
    await this.sendZipFile(res, file);
  }

  /**
   * @param {{ params: Object }} req
   * @param {Object} res
   * @returns {Promise<void>}
   */
  async downloadImport(req, res) {
    const file = await this.probabilityImportsService.getImportFile(req.params.uploadId);
    await this.sendZipFile(res, file);
  }

  /**
   * @param {Object} res
   * @param {{ path: string, metadata: Object }} file
   * @returns {Promise<void>}
   */
  async sendZipFile(res, file) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(file.metadata.originalFilename) + '"');

    await new Promise(function (resolve, reject) {
      res.sendFile(path.resolve(file.path), function (err) {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  }
}

module.exports = ProbabilityImportsController;
