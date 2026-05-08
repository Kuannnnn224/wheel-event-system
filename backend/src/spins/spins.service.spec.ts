import { SpinsService } from './spins.service';

const player = {
  id: 'player-id',
  externalId: 'player-001',
};

const prize = {
  rewardCode: 'A',
  name: 'A Prize',
  amountPoints: 100,
  lowWeight: 0,
  highWeight: 0,
  prizeWeight: 100,
  sortOrder: 1,
};

function createService(options?: { overrideRule?: unknown }) {
  const spinRecordRepository = {
    create: jest.fn((input) => input),
    save: jest.fn(),
  };
  const transactionSpinRecordRepository = {
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => ({ ...input, id: 'spin-id' })),
  };
  const progressRepository = {
    findOne: jest.fn().mockResolvedValue({ unlockedStage: 5 }),
  };
  const manager = {
    getRepository: jest.fn((entity) => (entity.name === 'SpinRecord' ? transactionSpinRecordRepository : progressRepository)),
  };
  const dataSource = {
    transaction: jest.fn((callback: (transactionManager: typeof manager) => Promise<unknown>) => callback(manager)),
  };
  const probabilityService = {
    drawPrize: jest.fn().mockResolvedValue({ table: 'low', prize }),
    drawPrizeForTable: jest.fn().mockResolvedValue({ table: 'prize', prize }),
  };
  const demoTokenService = {
    validateToken: jest.fn().mockResolvedValue(player),
  };
  const awardOverridesService = {
    findPendingForSpin: jest.fn().mockResolvedValue(options?.overrideRule ?? null),
    consume: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new SpinsService(
      spinRecordRepository as never,
      progressRepository as never,
      dataSource as never,
      probabilityService as never,
      demoTokenService as never,
      awardOverridesService as never,
    ),
    probabilityService,
    awardOverridesService,
  };
}

describe('SpinsService realSpin award override integration', () => {
  it('uses the prize table and consumes a pending award override', async () => {
    const overrideRule = { id: 'rule-id' };
    const { service, probabilityService, awardOverridesService } = createService({ overrideRule });

    const result = await service.realSpin({ token: 'token', stageNumber: 1 });

    expect(probabilityService.drawPrizeForTable).toHaveBeenCalledWith(1, 'prize');
    expect(probabilityService.drawPrize).not.toHaveBeenCalled();
    expect(awardOverridesService.consume).toHaveBeenCalledWith(overrideRule, 'spin-id', expect.anything());
    expect(result.probabilityTable).toBe('prize');
    expect(result.spin.probabilityTable).toBe('prize');
  });

  it('keeps the normal low high draw when no current pending override exists', async () => {
    const { service, probabilityService, awardOverridesService } = createService();

    const result = await service.realSpin({ token: 'token', stageNumber: 1 });

    expect(probabilityService.drawPrize).toHaveBeenCalledWith(1);
    expect(probabilityService.drawPrizeForTable).not.toHaveBeenCalled();
    expect(awardOverridesService.consume).not.toHaveBeenCalled();
    expect(result.probabilityTable).toBe('low');
  });
});
