import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StageThreshold } from '../domain/stage-progress';
import { pickWeightedPrize } from './probability-picker';
import { UpdateStagesDto } from './dto/update-stages.dto';
import { PrizeConfig } from './entities/prize-config.entity';
import { StageConfig } from './entities/stage-config.entity';

const DEFAULT_THRESHOLDS = [1000, 3000, 6000, 10000, 15000];

@Injectable()
export class ProbabilityService implements OnModuleInit {
  constructor(
    @InjectRepository(StageConfig)
    private readonly stageRepository: Repository<StageConfig>,
    @InjectRepository(PrizeConfig)
    private readonly prizeRepository: Repository<PrizeConfig>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultConfigs();
  }

  async getStages() {
    const stages = await this.stageRepository.find({
      relations: { prizes: true },
      order: {
        stageNumber: 'ASC',
        prizes: {
          sortOrder: 'ASC',
          id: 'ASC',
        },
      },
    });

    return stages.map((stage) => ({
      ...stage,
      prizes: [...(stage.prizes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    }));
  }

  async getStageThresholds(): Promise<StageThreshold[]> {
    return this.stageRepository.find({
      select: ['stageNumber', 'turnoverThresholdPoints', 'enabled'],
      order: { stageNumber: 'ASC' },
    });
  }

  async getPrizesForStage(stageNumber: number): Promise<PrizeConfig[]> {
    return this.prizeRepository.find({
      where: { stageNumber, enabled: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async drawPrize(stageNumber: number, rng = Math.random): Promise<PrizeConfig> {
    const stage = await this.stageRepository.findOne({ where: { stageNumber, enabled: true } });

    if (!stage) {
      throw new BadRequestException(`Stage ${stageNumber} is not enabled.`);
    }

    return pickWeightedPrize(await this.getPrizesForStage(stageNumber), rng);
  }

  async updateStages(dto: UpdateStagesDto) {
    this.assertValidStagePayload(dto);

    await this.dataSource.transaction(async (manager) => {
      const stageRepository = manager.getRepository(StageConfig);
      const prizeRepository = manager.getRepository(PrizeConfig);

      for (const stageInput of dto.stages) {
        const stage =
          (await stageRepository.findOne({ where: { stageNumber: stageInput.stageNumber } })) ??
          stageRepository.create({ stageNumber: stageInput.stageNumber });

        stage.turnoverThresholdPoints = stageInput.turnoverThresholdPoints;
        stage.enabled = stageInput.enabled;
        await stageRepository.save(stage);

        await prizeRepository.delete({ stageNumber: stageInput.stageNumber });
        await prizeRepository.save(
          stageInput.prizes.map((prize, index) =>
            prizeRepository.create({
              stageNumber: stageInput.stageNumber,
              stageConfig: stage,
              name: prize.name,
              weight: prize.weight,
              amountPoints: prize.amountPoints,
              enabled: prize.enabled,
              sortOrder: prize.sortOrder ?? index,
            }),
          ),
        );
      }
    });

    return this.getStages();
  }

  private assertValidStagePayload(dto: UpdateStagesDto) {
    const stageNumbers = dto.stages.map((stage) => stage.stageNumber);

    if (new Set(stageNumbers).size !== stageNumbers.length) {
      throw new BadRequestException('Duplicate stage numbers are not allowed.');
    }

    for (const stage of dto.stages) {
      if (stage.enabled && !stage.prizes.some((prize) => prize.enabled && prize.weight > 0)) {
        throw new BadRequestException(`Stage ${stage.stageNumber} needs at least one enabled weighted prize.`);
      }
    }
  }

  private async ensureDefaultConfigs() {
    const existingCount = await this.stageRepository.count();

    if (existingCount > 0) {
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const stageRepository = manager.getRepository(StageConfig);
      const prizeRepository = manager.getRepository(PrizeConfig);

      for (let index = 0; index < 5; index += 1) {
        const stageNumber = index + 1;
        const stage = await stageRepository.save({
          stageNumber,
          turnoverThresholdPoints: DEFAULT_THRESHOLDS[index],
          enabled: true,
        });

        await prizeRepository.save([
          {
            stageNumber,
            stageConfig: stage,
            name: 'No prize',
            weight: 700,
            amountPoints: 0,
            enabled: true,
            sortOrder: 1,
          },
          {
            stageNumber,
            stageConfig: stage,
            name: `Stage ${stageNumber} small prize`,
            weight: 250,
            amountPoints: stageNumber * 100,
            enabled: true,
            sortOrder: 2,
          },
          {
            stageNumber,
            stageConfig: stage,
            name: `Stage ${stageNumber} big prize`,
            weight: 50,
            amountPoints: stageNumber * 500,
            enabled: true,
            sortOrder: 3,
          },
        ]);
      }
    });
  }
}
