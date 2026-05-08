import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { resolveBusinessDate } from '../common/business-date';
import { SpinRecord } from '../spins/entities/spin-record.entity';
import { PlayerDailyProgress } from './entities/player-daily-progress.entity';
import { Player } from './entities/player.entity';

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    @InjectRepository(PlayerDailyProgress)
    private readonly progressRepository: Repository<PlayerDailyProgress>,
    @InjectRepository(SpinRecord)
    private readonly spinRecordRepository: Repository<SpinRecord>,
  ) {}

  async listPlayers(limit = 50) {
    return this.playerRepository.find({
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
  }

  async findByExternalId(externalId: string) {
    return this.playerRepository.findOne({ where: { externalId } });
  }

  async getById(id: string) {
    const player = await this.playerRepository.findOne({ where: { id } });

    if (!player) {
      throw new NotFoundException('Player not found.');
    }

    return player;
  }

  async getOrCreateByExternalId(externalId: string) {
    const existing = await this.findByExternalId(externalId);

    if (existing) {
      return existing;
    }

    return this.playerRepository.save(this.playerRepository.create({ externalId }));
  }

  async getDailyProgress(playerId: string, date?: string) {
    const player = await this.getById(playerId);
    const businessDate = resolveBusinessDate(date);
    const progress = await this.progressRepository.findOne({ where: { playerId, businessDate } });
    const spins = await this.spinRecordRepository.find({
      where: { playerId, businessDate },
      order: { stageNumber: 'ASC' },
    });

    return {
      player,
      businessDate,
      turnoverPoints: progress?.turnoverPoints ?? 0,
      unlockedStage: progress?.unlockedStage ?? 0,
      playedStages: spins.map((spin) => spin.stageNumber),
      totalWinPoints: spins.reduce((sum, spin) => sum + spin.amountPoints, 0),
      spins,
    };
  }
}
