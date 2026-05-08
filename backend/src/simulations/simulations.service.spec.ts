import type { ProbabilityService } from '../probability/probability.service';
import { SimulationsService } from './simulations.service';

function waitForJob() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('SimulationsService', () => {
  it('summarizes table entry rate and merged reward results', async () => {
    const draws = [
      { table: 'low', prize: { rewardCode: 'A', name: 'A Prize', amountPoints: 0 } },
      { table: 'high', prize: { rewardCode: 'B', name: 'B Prize', amountPoints: 10 } },
      { table: 'low', prize: { rewardCode: 'A', name: 'A Prize', amountPoints: 0 } },
      { table: 'high', prize: { rewardCode: 'C', name: 'C Prize', amountPoints: 20 } },
    ] as const;
    let drawIndex = 0;
    const probabilityService = {
      getDrawConfigForStage: jest.fn().mockResolvedValue({}),
      drawPrizeFromConfig: jest.fn().mockImplementation(() => draws[drawIndex++ % draws.length]),
    };
    const service = new SimulationsService(probabilityService as unknown as ProbabilityService);

    const created = await service.createJob({ stageNumber: 1, count: 4 });

    while (service.getJob(created.id).status !== 'completed') {
      await waitForJob();
    }

    const job = service.getJob(created.id);

    expect(job.tableResults).toEqual([
      { probabilityTable: 'low', count: 2 },
      { probabilityTable: 'high', count: 2 },
    ]);
    expect(job.prizeResults).toEqual([
      { rewardCode: 'A', name: 'A Prize', amountPoints: 0, count: 2, totalAmountPoints: 0 },
      { rewardCode: 'B', name: 'B Prize', amountPoints: 10, count: 1, totalAmountPoints: 10 },
      { rewardCode: 'C', name: 'C Prize', amountPoints: 20, count: 1, totalAmountPoints: 20 },
    ]);
    expect(job.totalAmountPoints).toBe(30);
    expect(job.averageAmountPoints).toBe(7.5);
  });
});
