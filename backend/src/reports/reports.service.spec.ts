import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { SpinRecord } from '../spins/entities/spin-record.entity';

function spin(overrides: Partial<SpinRecord>): SpinRecord {
  return {
    id: overrides.id ?? 'spin-id',
    playerId: overrides.playerId ?? 'player-1',
    player: undefined as never,
    businessDate: overrides.businessDate ?? '2026-05-09',
    stageNumber: overrides.stageNumber ?? 1,
    prizeName: overrides.prizeName ?? 'A Prize',
    amountPoints: overrides.amountPoints ?? 0,
    createdAt: overrides.createdAt ?? 0,
    probabilityTable: overrides.probabilityTable ?? 'low',
    setCreateTimestamp: jest.fn(),
    ...overrides,
  };
}

describe('ReportsService', () => {
  it('aggregates range reports by business date interval', async () => {
    const spinRecordRepository = {
      find: jest.fn().mockResolvedValue([
        spin({ playerId: 'player-1', stageNumber: 1, amountPoints: 10 }),
        spin({ playerId: 'player-2', stageNumber: 1, amountPoints: 20 }),
        spin({ playerId: 'player-1', stageNumber: 2, amountPoints: 30 }),
      ]),
    };
    const service = new ReportsService(spinRecordRepository as never, {} as never, {} as never);

    const report = await service.getRangeReport('2026-05-01', '2026-05-09');

    expect(report).toEqual({
      startDate: '2026-05-01',
      endDate: '2026-05-09',
      totalSpins: 3,
      uniquePlayers: 2,
      totalAmountPoints: 60,
      byStage: [
        { stageNumber: 1, spinCount: 2, totalAmountPoints: 30 },
        { stageNumber: 2, spinCount: 1, totalAmountPoints: 30 },
      ],
    });
  });

  it('rejects inverted report ranges', async () => {
    const service = new ReportsService({ find: jest.fn() } as never, {} as never, {} as never);

    await expect(service.getRangeReport('2026-05-09', '2026-05-01')).rejects.toThrow(BadRequestException);
  });
});
