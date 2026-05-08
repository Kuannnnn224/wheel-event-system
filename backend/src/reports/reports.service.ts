import { Injectable, NotFoundException } from '@nestjs/common';
import { Between, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SpinRecord } from '../spins/entities/spin-record.entity';
import { PlayerDailyProgress } from '../players/entities/player-daily-progress.entity';
import { PlayersService } from '../players/players.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(SpinRecord)
    private readonly spinRecordRepository: Repository<SpinRecord>,
    @InjectRepository(PlayerDailyProgress)
    private readonly progressRepository: Repository<PlayerDailyProgress>,
    private readonly playersService: PlayersService,
  ) {}

  async getDailyReport(date: string) {
    const spins = await this.spinRecordRepository.find({ where: { businessDate: date } });
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
      businessDate: date,
      totalSpins: spins.length,
      uniquePlayers: new Set(spins.map((spin) => spin.playerId)).size,
      totalAmountPoints: spins.reduce((sum, spin) => sum + spin.amountPoints, 0),
      byStage: [...byStage.values()].sort((a, b) => a.stageNumber - b.stageNumber),
    };
  }

  async getPlayerReport(externalId: string, startDate: string, endDate: string) {
    const player = await this.playersService.findByExternalId(externalId);

    if (!player) {
      throw new NotFoundException('Player not found.');
    }

    const [spins, progress] = await Promise.all([
      this.spinRecordRepository.find({
        where: {
          playerId: player.id,
          businessDate: Between(startDate, endDate),
        },
        order: { businessDate: 'ASC', stageNumber: 'ASC' },
      }),
      this.progressRepository.find({
        where: {
          playerId: player.id,
          businessDate: Between(startDate, endDate),
        },
        order: { businessDate: 'ASC' },
      }),
    ]);

    return {
      player,
      startDate,
      endDate,
      totalSpins: spins.length,
      totalAmountPoints: spins.reduce((sum, spin) => sum + spin.amountPoints, 0),
      progress,
      spins,
    };
  }
}
