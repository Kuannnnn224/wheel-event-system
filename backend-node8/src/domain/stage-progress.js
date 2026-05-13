'use strict';

/**
 * @typedef {Object} StageThreshold
 * @property {number} stageNumber
 * @property {number} turnoverThresholdPoints
 */

/**
 * 依照玩家流水與各階段門檻，計算目前已解鎖的最高階段。
 *
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
