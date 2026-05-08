import { calculateUnlockedStage } from './stage-progress';

const stages = [
  { stageNumber: 1, turnoverThresholdPoints: 1000, enabled: true },
  { stageNumber: 2, turnoverThresholdPoints: 3000, enabled: true },
  { stageNumber: 3, turnoverThresholdPoints: 6000, enabled: true },
  { stageNumber: 4, turnoverThresholdPoints: 10000, enabled: true },
  { stageNumber: 5, turnoverThresholdPoints: 15000, enabled: true },
];

describe('calculateUnlockedStage', () => {
  it('returns zero before the first threshold', () => {
    expect(calculateUnlockedStage(999, stages)).toBe(0);
  });

  it('returns the highest reached stage', () => {
    expect(calculateUnlockedStage(1000, stages)).toBe(1);
    expect(calculateUnlockedStage(9999, stages)).toBe(3);
    expect(calculateUnlockedStage(15000, stages)).toBe(5);
  });

  it('ignores disabled stages', () => {
    expect(calculateUnlockedStage(15000, [{ ...stages[4], enabled: false }])).toBe(0);
  });
});
