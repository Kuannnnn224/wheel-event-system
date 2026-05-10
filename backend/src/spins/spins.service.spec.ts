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
  dailyLimitWeight: 100,
  sortOrder: 1,
};

function createService(options?: { overrideRule?: unknown; dailyPayoutLimitPoints?: number; dailyTotalAmountPoints?: number }) {
  const spinRecordRepository = {
    create: jest.fn((input) => input),
    save: jest.fn(),
  };
  const transactionSpinRecordRepository = {
    find: jest.fn().mockResolvedValue([]),
    sum: jest.fn().mockResolvedValue(options?.dailyTotalAmountPoints ?? 0),
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
    drawPrizeForTable: jest.fn().mockImplementation(async (_stageNumber: number, table: string) => ({ table, prize })),
    getDailyPayoutLimitPoints: jest.fn().mockResolvedValue(options?.dailyPayoutLimitPoints ?? 0),
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
    transactionSpinRecordRepository,
  };
}

describe('SpinsService realSpin award override integration', () => {
  it('uses the prize table and consumes a pending award override', async () => {
    const overrideRule = { id: 'rule-id' };
    const { service, probabilityService, awardOverridesService, transactionSpinRecordRepository } = createService({
      overrideRule,
      dailyPayoutLimitPoints: 100,
      dailyTotalAmountPoints: 100,
    });

    const result = await service.realSpin({ token: 'token', stageNumber: 1 });

    expect(probabilityService.drawPrizeForTable).toHaveBeenCalledWith(1, 'prize');
    expect(probabilityService.drawPrize).not.toHaveBeenCalled();
    expect(transactionSpinRecordRepository.sum).not.toHaveBeenCalled();
    expect(awardOverridesService.consume).toHaveBeenCalledWith(overrideRule, 'spin-id', expect.anything());
    expect(transactionSpinRecordRepository.save).toHaveBeenCalledWith(expect.objectContaining({ probabilityTable: 'prize' }));
    expect(result).not.toHaveProperty('probabilityTable');
    expect(result.spin).not.toHaveProperty('probabilityTable');
  });

  it('keeps the normal low high draw when no current pending override exists', async () => {
    const { service, probabilityService, awardOverridesService } = createService();

    await service.realSpin({ token: 'token', stageNumber: 1 });

    expect(probabilityService.drawPrize).toHaveBeenCalledWith(1);
    expect(probabilityService.drawPrizeForTable).not.toHaveBeenCalled();
    expect(awardOverridesService.consume).not.toHaveBeenCalled();
  });

  it('keeps the normal low high draw when the daily payout total is below the limit', async () => {
    const { service, probabilityService } = createService({
      dailyPayoutLimitPoints: 101,
      dailyTotalAmountPoints: 100,
    });

    await service.realSpin({ token: 'token', stageNumber: 1 });

    expect(probabilityService.drawPrize).toHaveBeenCalledWith(1);
    expect(probabilityService.drawPrizeForTable).not.toHaveBeenCalled();
  });

  it('uses the dailyLimit table once the daily payout total reaches the limit', async () => {
    const { service, probabilityService, awardOverridesService, transactionSpinRecordRepository } = createService({
      dailyPayoutLimitPoints: 100,
      dailyTotalAmountPoints: 100,
    });

    const result = await service.realSpin({ token: 'token', stageNumber: 1 });

    expect(probabilityService.drawPrizeForTable).toHaveBeenCalledWith(1, 'dailyLimit');
    expect(probabilityService.drawPrize).not.toHaveBeenCalled();
    expect(awardOverridesService.consume).not.toHaveBeenCalled();
    expect(transactionSpinRecordRepository.save).toHaveBeenCalledWith(expect.objectContaining({ probabilityTable: 'dailyLimit' }));
    expect(result).not.toHaveProperty('probabilityTable');
    expect(result.spin).not.toHaveProperty('probabilityTable');
  });
});
