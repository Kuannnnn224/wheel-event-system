import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ProbabilityService } from '../probability/probability.service';
import { CreateSimulationDto } from './dto/create-simulation.dto';

export type SimulationStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface SimulationPrizeResult {
  probabilityTable: 'low' | 'high';
  rewardCode: string;
  name: string;
  amountPoints: number;
  count: number;
  totalAmountPoints: number;
}

export interface SimulationJob {
  id: string;
  status: SimulationStatus;
  stageNumber: number;
  requestedCount: number;
  completedCount: number;
  progressPercent: number;
  totalAmountPoints: number;
  prizeResults: SimulationPrizeResult[];
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  elapsedMs?: number;
}

@Injectable()
export class SimulationsService {
  private readonly jobs = new Map<string, SimulationJob>();

  constructor(private readonly probabilityService: ProbabilityService) {}

  async createJob(dto: CreateSimulationDto) {
    const job: SimulationJob = {
      id: randomUUID(),
      status: 'queued',
      stageNumber: dto.stageNumber,
      requestedCount: dto.count,
      completedCount: 0,
      progressPercent: 0,
      totalAmountPoints: 0,
      prizeResults: [],
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(job.id, job);
    void this.runJob(job.id);
    return job;
  }

  getJob(id: string) {
    const job = this.jobs.get(id);

    if (!job) {
      throw new NotFoundException('Simulation job not found.');
    }

    return job;
  }

  private async runJob(id: string) {
    const job = this.jobs.get(id);

    if (!job) {
      return;
    }

    try {
      job.status = 'running';
      job.startedAt = new Date().toISOString();
      const startedMs = Date.now();
      const drawConfig = await this.probabilityService.getDrawConfigForStage(job.stageNumber);
      const resultMap = new Map<string, SimulationPrizeResult>();
      const chunkSize = 50_000;

      while (job.completedCount < job.requestedCount) {
        const limit = Math.min(chunkSize, job.requestedCount - job.completedCount);

        for (let index = 0; index < limit; index += 1) {
          const draw = this.probabilityService.drawPrizeFromConfig(drawConfig);
          const key = `${draw.table}:${draw.prize.rewardCode}:${draw.prize.name}:${draw.prize.amountPoints}`;
          const current = resultMap.get(key) ?? {
            probabilityTable: draw.table,
            rewardCode: draw.prize.rewardCode,
            name: draw.prize.name,
            amountPoints: draw.prize.amountPoints,
            count: 0,
            totalAmountPoints: 0,
          };
          current.count += 1;
          current.totalAmountPoints += draw.prize.amountPoints;
          resultMap.set(key, current);
          job.totalAmountPoints += draw.prize.amountPoints;
        }

        job.completedCount += limit;
        job.progressPercent = Math.floor((job.completedCount / job.requestedCount) * 100);
        job.prizeResults = [...resultMap.values()].sort((a, b) => b.totalAmountPoints - a.totalAmountPoints);
        await new Promise((resolve) => setImmediate(resolve));
      }

      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.elapsedMs = Date.now() - startedMs;
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown simulation error.';
      job.completedAt = new Date().toISOString();
    }
  }
}
