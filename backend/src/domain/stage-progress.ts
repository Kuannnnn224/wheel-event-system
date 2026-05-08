export interface StageThreshold {
  stageNumber: number;
  turnoverThresholdPoints: number;
  enabled: boolean;
}

export function calculateUnlockedStage(turnoverPoints: number, stages: StageThreshold[]): number {
  return stages
    .filter((stage) => stage.enabled && turnoverPoints >= stage.turnoverThresholdPoints)
    .reduce((highest, stage) => Math.max(highest, stage.stageNumber), 0);
}
