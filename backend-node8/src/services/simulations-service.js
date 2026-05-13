'use strict';

const HttpError = require('../utils/http-error');
const ids = require('../utils/ids');

/**
 * 管理記憶體內的模擬任務執行狀態。
 */
class SimulationsService {
  /**
   * 初始化模擬 service，保存機率 service 並建立任務暫存區。
   *
   * @param {{ probabilityService: import('./probability-service') }} options
   */
  constructor(options) {
    this.probabilityService = options.probabilityService;
    this.jobs = {};
  }

  /**
   * 建立模擬工作並排入背景執行。
   *
   * @param {{ stageNumber: number|string, count: number|string }} input
   * @returns {Object}
   */
  createJob(input) {
    const dto = this.parseCreateInput(input);
    const job = {
      id: ids.pseudoUuid(),
      status: 'queued',
      stageNumber: dto.stageNumber,
      requestedCount: dto.count,
      completedCount: 0,
      progressPercent: 0,
      totalAmountPoints: 0,
      averageAmountPoints: 0,
      tableResults: [
        { probabilityTable: 'low', count: 0 },
        { probabilityTable: 'high', count: 0 }
      ],
      prizeResults: [],
      createdAt: new Date().toISOString()
    };

    this.jobs[job.id] = job;
    this.runJob(job.id);
    return job;
  }

  /**
   * 依 job id 取得模擬工作狀態。
   *
   * @param {string} id
   * @returns {Object}
   */
  getJob(id) {
    const job = this.jobs[id];

    if (!job) {
      throw HttpError.notFound('Simulation job not found.');
    }

    return job;
  }

  /**
   * 執行大量抽獎模擬並累計結果。
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  async runJob(id) {
    const job = this.jobs[id];

    if (!job) {
      return;
    }

    try {
      job.status = 'running';
      job.startedAt = new Date().toISOString();
      const startedMs = Date.now();
      const drawConfig = await this.probabilityService.getDrawConfigForStage(job.stageNumber);
      const resultMap = {};
      const tableCounts = {
        low: 0,
        high: 0
      };
      const chunkSize = 50000;

      while (job.completedCount < job.requestedCount) {
        const limit = Math.min(chunkSize, job.requestedCount - job.completedCount);

        for (let index = 0; index < limit; index += 1) {
          const draw = this.probabilityService.drawPrizeFromConfig(drawConfig);
          if (draw.table === 'low' || draw.table === 'high') {
            tableCounts[draw.table] += 1;
          }

          const key = draw.prize.rewardCode + ':' + draw.prize.name + ':' + draw.prize.amountPoints;
          if (!resultMap[key]) {
            resultMap[key] = {
              rewardCode: draw.prize.rewardCode,
              name: draw.prize.name,
              amountPoints: draw.prize.amountPoints,
              count: 0,
              totalAmountPoints: 0
            };
          }

          resultMap[key].count += 1;
          resultMap[key].totalAmountPoints += draw.prize.amountPoints;
          job.totalAmountPoints += draw.prize.amountPoints;
        }

        job.completedCount += limit;
        job.progressPercent = Math.floor((job.completedCount / job.requestedCount) * 100);
        job.averageAmountPoints = job.completedCount > 0 ? job.totalAmountPoints / job.completedCount : 0;
        job.tableResults = [
          { probabilityTable: 'low', count: tableCounts.low },
          { probabilityTable: 'high', count: tableCounts.high }
        ];
        job.prizeResults = Object.keys(resultMap).map(function (key) {
          return resultMap[key];
        }).sort(function (left, right) {
          return left.rewardCode.localeCompare(right.rewardCode);
        });

        await nextTick();
      }

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.elapsedMs = Date.now() - startedMs;
    } catch (err) {
      job.status = 'failed';
      job.error = err && err.message ? err.message : 'Unknown simulation error.';
      job.completedAt = new Date().toISOString();
    }
  }

  /**
   * 解析建立類 API 的輸入資料。
   *
   * @param {Object|null|undefined} input
   * @returns {{ stageNumber: number, count: number }}
   */
  parseCreateInput(input) {
    const messages = [];
    const stageNumber = Number(input ? input.stageNumber : undefined);
    const count = Number(input ? input.count : undefined);

    if (!Number.isInteger(stageNumber) || stageNumber < 1 || stageNumber > 5) {
      messages.push('stageNumber must be an integer between 1 and 5');
    }

    if (!Number.isInteger(count) || count < 1 || count > 10000000) {
      messages.push('count must be an integer between 1 and 10000000');
    }

    if (messages.length) {
      throw HttpError.badRequest(messages);
    }

    return {
      stageNumber: stageNumber,
      count: count
    };
  }
}

/**
 * 讓大量模擬工作釋放事件迴圈，避免阻塞 server。
 *
 * @returns {Promise<void>}
 */
function nextTick() {
  return new Promise(function (resolve) {
    setImmediate(resolve);
  });
}

module.exports = SimulationsService;
