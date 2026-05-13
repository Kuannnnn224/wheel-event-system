'use strict';

const path = require('path');
const HttpError = require('../utils/http-error');

/**
 * 機率 XLSX zip 匯入 API 的 Express controller。
 */
class ProbabilityImportsController {
  /**
   * 初始化機率匯入 controller，保存機率匯入 service。
   *
   * @param {import('../services/probability-imports-service')} probabilityImportsService
   */
  constructor(probabilityImportsService) {
    this.probabilityImportsService = probabilityImportsService;
  }

  /**
   * 處理機率 ZIP 預覽 request，回傳 diff 與暫存資訊。
   *
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
   * 處理機率 ZIP 套用 request，覆寫目前機率設定。
   *
   * @param {{ body?: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async applyImport(req, res) {
    res.json(await this.probabilityImportsService.applyImportUpload(req.body ? req.body.uploadId : ''));
  }

  /**
   * 回傳已上傳過的機率 ZIP 清單。
   *
   * @param {Object} _req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async getImports(_req, res) {
    res.json(await this.probabilityImportsService.listImportUploads());
  }

  /**
   * 產生機率 ZIP 下載用的短效 token。
   *
   * @param {{ params: Object }} req
   * @param {{ json: Function }} res
   * @returns {Promise<void>}
   */
  async createDownloadToken(req, res) {
    res.json(await this.probabilityImportsService.createDownloadToken(req.params.uploadId));
  }

  /**
   * 使用短效 token 下載機率 ZIP。
   *
   * @param {{ params: Object }} req
   * @param {Object} res
   * @returns {Promise<void>}
   */
  async downloadImportByToken(req, res) {
    const file = await this.probabilityImportsService.getImportFileByDownloadToken(req.params.token);
    await this.sendZipFile(res, file);
  }

  /**
   * 使用匯入 id 下載機率 ZIP。
   *
   * @param {{ params: Object }} req
   * @param {Object} res
   * @returns {Promise<void>}
   */
  async downloadImport(req, res) {
    const file = await this.probabilityImportsService.getImportFile(req.params.uploadId);
    await this.sendZipFile(res, file);
  }

  /**
   * 設定下載 header 並串流回傳 ZIP 檔。
   *
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
