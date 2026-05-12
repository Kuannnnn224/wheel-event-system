'use strict';

/**
 * @typedef {Object} StageThreshold
 * @property {number} stageNumber
 * @property {number} turnoverThresholdPoints
 */

/**
 * @param {number} turnoverPoints
 * @param {StageThreshold[]} stages
 * @returns {number}
 */
function calculateUnlockedStage(turnoverPoints, stages) {
  return stages.filter(function (stage) {
    return turnoverPoints >= stage.turnoverThresholdPoints;
  }).reduce(function (highest, stage) {
    return Math.max(highest, stage.stageNumber);
  }, 0);
}

module.exports = {
  calculateUnlockedStage: calculateUnlockedStage
};
