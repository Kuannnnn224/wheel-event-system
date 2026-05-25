import { describe, expect, it } from 'vitest';
import { defaultProbabilityConfig } from './defaultProbabilityConfig';
import { drawPrize, getExpectedAmountPoints, normalizeProbabilityConfig } from './probability';

describe('pm probability helpers', () => {
  it('normalizes legacy config fields to backend-compatible defaults', () => {
    const config = normalizeProbabilityConfig({
      version: 1,
      stages: defaultProbabilityConfig.stages.map((stage) => ({
        ...stage,
        prizes: stage.prizes.map(({ prizeWeight: _prizeWeight, dailyLimitWeight: _dailyLimitWeight, ...prize }) => prize),
      })),
    });

    expect(config.dailyPayoutLimitPoints).toBe(0);
    expect(config.stages[0].prizes[0].prizeWeight).toBe(config.stages[0].prizes[0].highWeight);
    expect(config.stages[0].prizes[0].dailyLimitWeight).toBe(config.stages[0].prizes[0].lowWeight);
  });

  it('draws by split table then prize weight', () => {
    const stage = normalizeProbabilityConfig(defaultProbabilityConfig).stages[0];
    const result = drawPrize(stage, 'split', () => 0);

    expect(result.table).toBe('low');
    expect(result.prize.rewardCode).toBe('A');
  });

  it('computes expected amount for direct table mode', () => {
    const stage = normalizeProbabilityConfig(defaultProbabilityConfig).stages[0];

    expect(getExpectedAmountPoints(stage, 'low')).toBeCloseTo(2.29, 2);
  });
});
