import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { resolveCurrentBusinessDate } from '../common/business-date';
import { calculateUnlockedStage } from '../domain/stage-progress';
import { PlayerDailyProgress } from '../players/entities/player-daily-progress.entity';
import { PlayersService } from '../players/players.service';
import { ProbabilityService } from '../probability/probability.service';
import { AddTurnoverAdjustmentDto } from './dto/add-turnover-adjustment.dto';
import { TurnoverAdjustment } from './entities/turnover-adjustment.entity';

@Injectable()
export class TurnoverService {
  constructor(
    @InjectRepository(TurnoverAdjustment)
    private readonly adjustmentRepository: Repository<TurnoverAdjustment>,
    private readonly dataSource: DataSource,
    private readonly playersService: PlayersService,
    private readonly probabilityService: ProbabilityService,
  ) {}

  async addAdjustment(playerId: string, dto: AddTurnoverAdjustmentDto) {
    const player = await this.playersService.getById(playerId);
    const businessDate = resolveCurrentBusinessDate(dto.date);
    const stageThresholds = await this.probabilityService.getStageThresholds();

    await this.dataSource.transaction(async (manager) => {
      const progressRepository = manager.getRepository(PlayerDailyProgress);
      const adjustmentRepository = manager.getRepository(TurnoverAdjustment);
      let progress = await progressRepository.findOne({ where: { playerId, businessDate } });

      if (!progress) {
        progress = progressRepository.create({
          playerId,
          player,
          businessDate,
          turnoverPoints: 0,
          unlockedStage: 0,
        });
      }

      progress.turnoverPoints += dto.amountPoints;
      progress.unlockedStage = calculateUnlockedStage(progress.turnoverPoints, stageThresholds);
      await progressRepository.save(progress);

      await adjustmentRepository.save(
        adjustmentRepository.create({
          playerId,
          player,
          businessDate,
          amountPoints: dto.amountPoints,
          reason: dto.reason,
          source: 'admin',
        }),
      );
    });

    return this.playersService.getDailyProgress(playerId, businessDate);
  }
}
