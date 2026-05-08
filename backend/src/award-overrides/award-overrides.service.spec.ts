import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AwardOverridesService } from './award-overrides.service';
import { AwardOverrideRule } from './entities/award-override-rule.entity';

const player = {
  id: 'player-id',
  externalId: 'player-001',
};

function createService(options?: {
  playerResult?: typeof player | null;
  existingSpins?: Array<{ stageNumber: number }>;
  existingRules?: Array<Partial<AwardOverrideRule>>;
}) {
  const overrideRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const spinRepository = {
    find: jest.fn().mockResolvedValue(options?.existingSpins ?? []),
  };
  const transactionOverrideRepository = {
    find: jest.fn().mockResolvedValue(options?.existingRules ?? []),
    create: jest.fn((input: Partial<AwardOverrideRule>) => input),
    save: jest.fn(async (rules: AwardOverrideRule[]) => rules),
  };
  const dataSource = {
    transaction: jest.fn((callback: (manager: unknown) => Promise<unknown>) =>
      callback({
        getRepository: jest.fn((entity) => (entity.name === 'SpinRecord' ? spinRepository : transactionOverrideRepository)),
      }),
    ),
  };
  const playersService = {
    findByExternalId: jest.fn().mockResolvedValue(options?.playerResult === undefined ? player : options.playerResult),
  };

  return {
    service: new AwardOverridesService(overrideRepository as never, dataSource as never, playersService as never),
    overrideRepository,
    spinRepository,
    transactionOverrideRepository,
    playersService,
  };
}

describe('AwardOverridesService', () => {
  it('rejects creating rules for missing players', async () => {
    const { service } = createService({ playerResult: null });

    await expect(service.create({ externalId: 'missing', stageNumbers: [1] }, 'admin-id')).rejects.toThrow(NotFoundException);
  });

  it('rejects creating rules for stages already played today', async () => {
    const { service } = createService({ existingSpins: [{ stageNumber: 1 }] });

    await expect(service.create({ externalId: 'player-001', stageNumbers: [1, 3] }, 'admin-id')).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate pending rules for the same player date and stage', async () => {
    const { service } = createService({ existingRules: [{ stageNumber: 3 }] });

    await expect(service.create({ externalId: 'player-001', stageNumbers: [3] }, 'admin-id')).rejects.toThrow(BadRequestException);
  });

  it('creates one pending rule per selected stage', async () => {
    const { service, transactionOverrideRepository } = createService();

    const rules = await service.create({ externalId: 'player-001', stageNumbers: [3, 1], reason: 'vip make-good' }, 'admin-id');

    expect(rules).toHaveLength(2);
    expect(transactionOverrideRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'player-id',
        stageNumber: 1,
        status: 'pending',
        reason: 'vip make-good',
        createdByAdminId: 'admin-id',
      }),
    );
    expect(transactionOverrideRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        stageNumber: 3,
      }),
    );
  });

  it('cancels pending rules and clears the pending key', async () => {
    const { service, overrideRepository } = createService();
    const rule = {
      id: 'rule-id',
      status: 'pending',
      pendingKey: 'player-id:2026-05-09:1',
    } as AwardOverrideRule;
    overrideRepository.findOne.mockResolvedValue(rule);
    overrideRepository.save.mockImplementation(async (input: AwardOverrideRule) => input);

    const cancelled = await service.cancel('rule-id', 'admin-id');

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.pendingKey).toBeNull();
    expect(cancelled.cancelledByAdminId).toBe('admin-id');
    expect(cancelled.cancelledAt).toEqual(expect.any(Number));
  });
});
