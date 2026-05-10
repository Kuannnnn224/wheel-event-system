import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Between, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SpinRecord } from '../spins/entities/spin-record.entity';
import { PlayerDailyProgress } from '../players/entities/player-daily-progress.entity';
import { PlayersService } from '../players/players.service';
import { assertBusinessDate } from '../common/business-date';
import { ProbabilityService } from '../probability/probability.service';

interface SpinAggregate {
  totalSpins: number;
  uniquePlayers: number;
  totalAmountPoints: number;
  byStage: Array<{ stageNumber: number; spinCount: number; totalAmountPoints: number }>;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(SpinRecord)
    private readonly spinRecordRepository: Repository<SpinRecord>,
    @InjectRepository(PlayerDailyProgress)
    private readonly progressRepository: Repository<PlayerDailyProgress>,
    private readonly playersService: PlayersService,
    private readonly probabilityService: ProbabilityService,
  ) {}

  async getDailyReport(date: string) {
    const businessDate = this.assertReportDate(date, 'date');
    const report = await this.getRangeReport(businessDate, businessDate);
    const dailyPayoutLimitPoints = await this.probabilityService.getDailyPayoutLimitPoints();

    return {
      businessDate,
      totalSpins: report.totalSpins,
      uniquePlayers: report.uniquePlayers,
      totalAmountPoints: report.totalAmountPoints,
      dailyPayoutLimitPoints,
      dailyLimitActive: dailyPayoutLimitPoints > 0 && report.totalAmountPoints >= dailyPayoutLimitPoints,
      byStage: report.byStage,
    };
  }

  async getRangeReport(startDate: string, endDate: string) {
    const range = this.resolveReportRange(startDate, endDate);
    const spins = await this.spinRecordRepository.find({
      where: { businessDate: Between(range.startDate, range.endDate) },
    });
    const aggregate = this.aggregateSpins(spins);

    return {
      ...range,
      ...aggregate,
    };
  }

  async getPlayerReport(externalId: string, startDate: string, endDate: string) {
    const range = this.resolveReportRange(startDate, endDate);
    const player = await this.playersService.findByExternalId(externalId);

    if (!player) {
      throw new NotFoundException('Player not found.');
    }

    const [spins, progress] = await Promise.all([
      this.spinRecordRepository.find({
        where: {
          playerId: player.id,
          businessDate: Between(range.startDate, range.endDate),
        },
        order: { businessDate: 'ASC', stageNumber: 'ASC' },
      }),
      this.progressRepository.find({
        where: {
          playerId: player.id,
          businessDate: Between(range.startDate, range.endDate),
        },
        order: { businessDate: 'ASC' },
      }),
    ]);

    return {
      player,
      ...range,
      totalSpins: spins.length,
      totalAmountPoints: spins.reduce((sum, spin) => sum + spin.amountPoints, 0),
      progress,
      spins,
    };
  }

  private aggregateSpins(spins: SpinRecord[]): SpinAggregate {
    const byStage = new Map<number, { stageNumber: number; spinCount: number; totalAmountPoints: number }>();

    for (const spin of spins) {
      const current = byStage.get(spin.stageNumber) ?? {
        stageNumber: spin.stageNumber,
        spinCount: 0,
        totalAmountPoints: 0,
      };
      current.spinCount += 1;
      current.totalAmountPoints += spin.amountPoints;
      byStage.set(spin.stageNumber, current);
    }

    return {
      totalSpins: spins.length,
      uniquePlayers: new Set(spins.map((spin) => spin.playerId)).size,
      totalAmountPoints: spins.reduce((sum, spin) => sum + spin.amountPoints, 0),
      byStage: [...byStage.values()].sort((a, b) => a.stageNumber - b.stageNumber),
    };
  }

  private resolveReportRange(startDate: string, endDate: string) {
    const normalizedStartDate = this.assertReportDate(startDate, 'startDate');
    const normalizedEndDate = this.assertReportDate(endDate, 'endDate');

    if (normalizedStartDate > normalizedEndDate) {
      throw new BadRequestException('startDate must be before or equal to endDate.');
    }

    return { startDate: normalizedStartDate, endDate: normalizedEndDate };
  }

  private assertReportDate(value: string | undefined, fieldName: string) {
    if (!value) {
      throw new BadRequestException(`${fieldName} is required.`);
    }

    try {
      return assertBusinessDate(value);
    } catch {
      throw new BadRequestException(`${fieldName} must use YYYY-MM-DD.`);
    }
  }
}
