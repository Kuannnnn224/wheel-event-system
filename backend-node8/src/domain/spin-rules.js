'use strict';

/**
 * 驗證真實抽獎是否符合解鎖與依序抽獎規則。
 *
 * @param {{ requestedStage: number, unlockedStage: number, playedStages: number[] }} input
 * @returns {{ allowed: boolean, reason?: string }}
 */
function validateRealSpinRule(input) {
  const requestedStage = input.requestedStage;
  const unlockedStage = input.unlockedStage;
  const playedStages = input.playedStages;

  if (requestedStage < 1 || requestedStage > 5) {
    return { allowed: false, reason: 'Stage must be between 1 and 5.' };
  }

  if (requestedStage > unlockedStage) {
    return { allowed: false, reason: 'Stage is not unlocked for this business date.' };
  }

  if (playedStages.indexOf(requestedStage) !== -1) {
    return { allowed: false, reason: 'Stage was already played for this business date.' };
  }

  if (requestedStage > 1 && playedStages.indexOf(requestedStage - 1) === -1) {
    return { allowed: false, reason: 'Previous stage must be completed first.' };
  }

  return { allowed: true };
}

module.exports = {
  validateRealSpinRule: validateRealSpinRule
};
