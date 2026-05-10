import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AwardOverridesService } from '../award-overrides/award-overrides.service';
import { resolveCurrentBusinessDate } from '../common/business-date';
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
    private readonly dataSource: DataSource,
    private readonly probabilityService: ProbabilityService,
    private readonly demoTokenService: DemoTokenService,
    private readonly awardOverridesService: AwardOverridesService,
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
    const businessDate = resolveCurrentBusinessDate(dto.date);

    return this.dataSource.transaction(async (manager) => {
      const progressRepository = manager.getRepository(PlayerDailyProgress);
      const spinRecordRepository = manager.getRepository(SpinRecord);
      const progress = await progressRepository.findOne({ where: { playerId: player.id, businessDate } });
      const existingSpins = await spinRecordRepository.find({
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

      const overrideRule = await this.awardOverridesService.findPendingForSpin(player.id, businessDate, dto.stageNumber, manager);
      const draw = overrideRule
        ? await this.probabilityService.drawPrizeForTable(dto.stageNumber, 'prize')
        : await this.shouldUseDailyLimitTable(spinRecordRepository, businessDate)
          ? await this.probabilityService.drawPrizeForTable(dto.stageNumber, 'dailyLimit')
          : await this.probabilityService.drawPrize(dto.stageNumber);
      const spin = await spinRecordRepository.save(
        spinRecordRepository.create({
          playerId: player.id,
          player,
          businessDate,
          stageNumber: dto.stageNumber,
          probabilityTable: draw.table,
          prizeName: draw.prize.name,
          amountPoints: draw.prize.amountPoints,
        }),
      );

      if (overrideRule) {
        await this.awardOverridesService.consume(overrideRule, spin.id, manager);
      }

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
    });
  }

  private async shouldUseDailyLimitTable(spinRecordRepository: Repository<SpinRecord>, businessDate: string) {
    const dailyPayoutLimitPoints = await this.probabilityService.getDailyPayoutLimitPoints();

    if (dailyPayoutLimitPoints <= 0) {
      return false;
    }

    const totalAmountPoints = await spinRecordRepository.sum('amountPoints', { businessDate });
    return (totalAmountPoints ?? 0) >= dailyPayoutLimitPoints;
  }
}
