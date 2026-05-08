export interface StageThreshold {
  stageNumber: number;
  turnoverThresholdPoints: number;
}

export function calculateUnlockedStage(turnoverPoints: number, stages: StageThreshold[]): number {
  return stages
    .filter((stage) => turnoverPoints >= stage.turnoverThresholdPoints)
    .reduce((highest, stage) => Math.max(highest, stage.stageNumber), 0);
}
