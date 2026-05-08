import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { resolveBusinessDate } from '../common/business-date';
import { validateRealSpinRule } from '../domain/spin-rules';
import { DemoTokenService } from '../demo-token/demo-token.service';
import { PlayerDailyProgress } from '../players/entities/player-daily-progress.entity';
import { ProbabilityService } from '../probability/probability.service';
import { RealSpinDto } from './dto/real-spin.dto';
import { SimulateSpinDto } from './dto/simulate-spin.dto';
import { SpinRecord } from './entities/spin-record.entity';

@Injectable()
export class SpinsService {
  constructor(
    @InjectRepository(SpinRecord)
    private readonly spinRecordRepository: Repository<SpinRecord>,
    @InjectRepository(PlayerDailyProgress)
    private readonly progressRepository: Repository<PlayerDailyProgress>,
    private readonly probabilityService: ProbabilityService,
    private readonly demoTokenService: DemoTokenService,
  ) {}

  async simulate(dto: SimulateSpinDto) {
    const draw = await this.probabilityService.drawPrize(dto.stageNumber);
    return {
      stageNumber: dto.stageNumber,
      probabilityTable: draw.table,
      prize: {
        rewardCode: draw.prize.rewardCode,
        name: draw.prize.name,
        amountPoints: draw.prize.amountPoints,
      },
    };
  }

  async realSpin(dto: RealSpinDto) {
    const player = await this.demoTokenService.validateToken(dto.token);
    const businessDate = resolveBusinessDate(dto.date);
    const progress = await this.progressRepository.findOne({ where: { playerId: player.id, businessDate } });
    const existingSpins = await this.spinRecordRepository.find({
      where: { playerId: player.id, businessDate },
      order: { stageNumber: 'ASC' },
    });
    const rule = validateRealSpinRule({
      requestedStage: dto.stageNumber,
      unlockedStage: progress?.unlockedStage ?? 0,
      playedStages: existingSpins.map((spin) => spin.stageNumber),
    });

    if (!rule.allowed) {
      throw new BadRequestException(rule.reason);
    }

    const draw = await this.probabilityService.drawPrize(dto.stageNumber);
    const spin = await this.spinRecordRepository.save(
      this.spinRecordRepository.create({
        playerId: player.id,
        player,
        businessDate,
        stageNumber: dto.stageNumber,
        probabilityTable: draw.table,
        prizeName: draw.prize.name,
        amountPoints: draw.prize.amountPoints,
      }),
    );

    return {
      player,
      businessDate,
      spin,
      probabilityTable: draw.table,
      prize: {
        rewardCode: draw.prize.rewardCode,
        name: draw.prize.name,
        amountPoints: draw.prize.amountPoints,
      },
    };
  }
}
