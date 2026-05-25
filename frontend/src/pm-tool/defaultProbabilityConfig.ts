import type { ProbabilityConfig } from './types';

const stageSeeds = [
  {
    stageNumber: 1,
    turnoverThresholdPoints: 500,
    lowTableWeight: 960,
    highTableWeight: 40,
    prizes: [
      ['A', '\u20b11', 1, 1, 64, 41],
      ['B', '\u20b13', 3, 2, 30, 50],
      ['C', '\u20b110', 10, 3, 5, 7],
      ['D', '\u20b125', 25, 4, 1, 2],
      ['E', '\u20b1500', 500, 5, 0, 0],
    ],
  },
  {
    stageNumber: 2,
    turnoverThresholdPoints: 5000,
    lowTableWeight: 950,
    highTableWeight: 50,
    prizes: [
      ['A', '\u20b13', 3, 1, 64, 40],
      ['B', '\u20b18', 8, 2, 30, 50],
      ['C', '\u20b150', 50, 3, 5, 7],
      ['D', '\u20b1250', 250, 4, 1, 3],
      ['E', '\u20b15000', 5000, 5, 0, 0],
    ],
  },
  {
    stageNumber: 3,
    turnoverThresholdPoints: 20000,
    lowTableWeight: 940,
    highTableWeight: 60,
    prizes: [
      ['A', '\u20b18', 8, 1, 64, 40],
      ['B', '\u20b115', 15, 2, 30, 50],
      ['C', '\u20b150', 50, 3, 5, 7],
      ['D', '\u20b1300', 300, 4, 1, 3],
      ['E', '\u20b120000', 20000, 5, 0, 0],
    ],
  },
  {
    stageNumber: 4,
    turnoverThresholdPoints: 50000,
    lowTableWeight: 930,
    highTableWeight: 70,
    prizes: [
      ['A', '\u20b115', 15, 1, 64, 40],
      ['B', '\u20b130', 30, 2, 30, 50],
      ['C', '\u20b180', 80, 3, 5, 7],
      ['D', '\u20b1500', 500, 4, 1, 3],
      ['E', '\u20b150000', 50000, 5, 0, 0],
    ],
  },
  {
    stageNumber: 5,
    turnoverThresholdPoints: 100000,
    lowTableWeight: 920,
    highTableWeight: 80,
    prizes: [
      ['A', '\u20b130', 30, 1, 64, 40],
      ['B', '\u20b180', 80, 2, 30, 50],
      ['C', '\u20b1300', 300, 3, 5, 7],
      ['D', '\u20b11000', 1000, 4, 1, 3],
      ['E', '\u20b1100000', 100000, 5, 0, 0],
    ],
  },
] as const;

export const defaultProbabilityConfig: ProbabilityConfig = {
  version: 1,
  dailyPayoutLimitPoints: 0,
  stages: stageSeeds.map((stage) => ({
    stageNumber: stage.stageNumber,
    turnoverThresholdPoints: stage.turnoverThresholdPoints,
    lowTableWeight: stage.lowTableWeight,
    highTableWeight: stage.highTableWeight,
    prizes: stage.prizes.map(([rewardCode, name, amountPoints, sortOrder, lowWeight, highWeight]) => ({
      rewardCode,
      name,
      amountPoints,
      sortOrder,
      lowWeight,
      highWeight,
      prizeWeight: highWeight,
      dailyLimitWeight: lowWeight,
    })),
  })),
};
