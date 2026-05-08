export interface SpinRuleInput {
  requestedStage: number;
  unlockedStage: number;
  playedStages: number[];
}

export interface SpinRuleResult {
  allowed: boolean;
  reason?: string;
}

export function validateRealSpinRule(input: SpinRuleInput): SpinRuleResult {
  const { requestedStage, unlockedStage, playedStages } = input;

  if (requestedStage < 1 || requestedStage > 5) {
    return { allowed: false, reason: 'Stage must be between 1 and 5.' };
  }

  if (requestedStage > unlockedStage) {
    return { allowed: false, reason: 'Stage is not unlocked for this business date.' };
  }

  if (playedStages.includes(requestedStage)) {
    return { allowed: false, reason: 'Stage was already played for this business date.' };
  }

  if (requestedStage > 1 && !playedStages.includes(requestedStage - 1)) {
    return { allowed: false, reason: 'Previous stage must be completed first.' };
  }

  return { allowed: true };
}
