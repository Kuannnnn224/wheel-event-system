import { BadRequestException } from '@nestjs/common';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProbabilityConfigFile } from './probability-config.types';
import { ProbabilityService } from './probability.service';

function createService() {
  const configPath = join(mkdtempSync(join(tmpdir(), 'probability-service-')), 'probability.json');
  return new ProbabilityService({
    get: (_key: string, fallback: string) => configPath || fallback,
  } as never);
}

function createConfig(overrides: Partial<ProbabilityConfigFile['stages'][number]> = {}): ProbabilityConfigFile {
  return {
    version: 1,
    dailyPayoutLimitPoints: 1000,
    stages: [1, 2, 3, 4, 5].map((stageNumber) => ({
      stageNumber,
      turnoverThresholdPoints: stageNumber * 100,
      lowTableWeight: 80,
      highTableWeight: 20,
      prizes: [
        { rewardCode: 'A', name: 'A Prize', amountPoints: 0, lowWeight: 10, highWeight: 100, prizeWeight: 0, dailyLimitWeight: 90, sortOrder: 1 },
        { rewardCode: 'B', name: 'B Prize', amountPoints: 100, lowWeight: 90, highWeight: 0, prizeWeight: 50, dailyLimitWeight: 10, sortOrder: 2 },
        { rewardCode: 'C', name: 'C Prize', amountPoints: 200, lowWeight: 0, highWeight: 0, prizeWeight: 0, dailyLimitWeight: 0, sortOrder: 3 },
        { rewardCode: 'D', name: 'D Prize', amountPoints: 300, lowWeight: 0, highWeight: 0, prizeWeight: 0, dailyLimitWeight: 0, sortOrder: 4 },
        { rewardCode: 'E', name: 'E Prize', amountPoints: 400, lowWeight: 0, highWeight: 0, prizeWeight: 0, dailyLimitWeight: 0, sortOrder: 5 },
      ],
      ...overrides,
    })),
  };
}

describe('ProbabilityService', () => {
  it('draws from a specified prize table without using the low/high split', () => {
    const service = createService();
    const config = service.normalizeConfig(createConfig()).stages[0];

    const result = service.drawPrizeFromConfigForTable({ stage: config, prizes: config.prizes }, 'prize', () => 0.99);

    expect(result.table).toBe('prize');
    expect(result.prize.rewardCode).toBe('B');
  });

  it('keeps drawPrizeFromConfig low/high split behavior unchanged', () => {
    const service = createService();
    const config = service.normalizeConfig(createConfig()).stages[0];

    const result = service.drawPrizeFromConfig({ stage: config, prizes: config.prizes }, () => 0.99);

    expect(result.table).toBe('high');
    expect(result.prize.rewardCode).toBe('A');
  });

  it('draws from the dailyLimit table when explicitly requested', () => {
    const service = createService();
    const config = service.normalizeConfig(createConfig()).stages[0];

    const result = service.drawPrizeFromConfigForTable({ stage: config, prizes: config.prizes }, 'dailyLimit', () => 0.99);

    expect(result.table).toBe('dailyLimit');
    expect(result.prize.rewardCode).toBe('B');
  });

  it('fills legacy defaults when config omits top-level limit and new table weights', () => {
    const service = createService();
    const legacyConfig = createConfig({
      prizes: createConfig().stages[0].prizes.map(({ prizeWeight, dailyLimitWeight, ...prize }) => prize) as never,
    }) as never as ProbabilityConfigFile;
    delete (legacyConfig as Partial<ProbabilityConfigFile>).dailyPayoutLimitPoints;

    const normalized = service.normalizeConfig(legacyConfig);

    expect(normalized.dailyPayoutLimitPoints).toBe(0);
    expect(normalized.stages[0].prizes[0].prizeWeight).toBe(100);
    expect(normalized.stages[0].prizes[0].dailyLimitWeight).toBe(10);
  });

  it('rejects negative prizeWeight values', () => {
    const service = createService();
    const config = createConfig({
      prizes: createConfig().stages[0].prizes.map((prize) =>
        prize.rewardCode === 'B' ? { ...prize, prizeWeight: -1 } : prize,
      ),
    });

    expect(() => service.normalizeConfig(config)).toThrow(BadRequestException);
  });

  it('rejects negative dailyLimitWeight values', () => {
    const service = createService();
    const config = createConfig({
      prizes: createConfig().stages[0].prizes.map((prize) =>
        prize.rewardCode === 'B' ? { ...prize, dailyLimitWeight: -1 } : prize,
      ),
    });

    expect(() => service.normalizeConfig(config)).toThrow(BadRequestException);
  });

  it('requires each stage to have at least one positive prizeWeight', () => {
    const service = createService();
    const config = createConfig({
      prizes: createConfig().stages[0].prizes.map((prize) => ({ ...prize, prizeWeight: 0 })),
    });

    expect(() => service.normalizeConfig(config)).toThrow(BadRequestException);
  });

  it('requires each stage to have at least one positive dailyLimitWeight', () => {
    const service = createService();
    const config = createConfig({
      prizes: createConfig().stages[0].prizes.map((prize) => ({ ...prize, dailyLimitWeight: 0 })),
    });

    expect(() => service.normalizeConfig(config)).toThrow(BadRequestException);
  });
});
