'use strict';

const HttpError = require('../utils/http-error');

/**
 * @typedef {Object} SimulateSpinInput
 * @property {number|string} stageNumber
 */

/**
 * Handles spin simulation and later real spin orchestration.
 */
class SpinsService {
  /**
   * @param {{ probabilityService: import('./probability-service') }} options
   */
  constructor(options) {
    this.probabilityService = options.probabilityService;
  }

  /**
   * @param {SimulateSpinInput} input
   * @returns {Promise<Object>}
   */
  async simulate(input) {
    const stageNumber = this.parseStageNumber(input);
    const draw = await this.probabilityService.drawPrize(stageNumber);

    return {
      stageNumber: stageNumber,
      probabilityTable: draw.table,
      prize: {
        rewardCode: draw.prize.rewardCode,
        name: draw.prize.name,
        amountPoints: draw.prize.amountPoints
      }
    };
  }

  /**
   * @param {SimulateSpinInput|Object|null|undefined} input
   * @returns {number}
   */
  parseStageNumber(input) {
    const rawValue = input ? input.stageNumber : undefined;
    const stageNumber = Number(rawValue);

    if (!Number.isInteger(stageNumber)) {
      throw HttpError.badRequest(['stageNumber must be an integer number']);
    }

    if (stageNumber < 1) {
      throw HttpError.badRequest(['stageNumber must not be less than 1']);
    }

    if (stageNumber > 5) {
      throw HttpError.badRequest(['stageNumber must not be greater than 5']);
    }

    return stageNumber;
  }
}

module.exports = SpinsService;
