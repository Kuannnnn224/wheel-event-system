import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, isAbsolute, resolve } from 'path';
import { StageThreshold } from '../domain/stage-progress';
import { pickProbabilityTable, pickWeightedItem, ProbabilityTable } from './probability-picker';
import {
  DrawPrizeResult,
  ProbabilityConfigFile,
  ProbabilityPrizeConfig,
  ProbabilityStageConfig,
  StageDrawConfig,
} from './probability-config.types';

const REWARD_CODES = ['A', 'B', 'C', 'D', 'E'];
const DEFAULT_CONFIG: ProbabilityConfigFile = {
  version: 1,
  stages: [1, 2, 3, 4, 5].map((stageNumber) => ({
    stageNumber,
    turnoverThresholdPoints: [1000, 3000, 6000, 10000, 15000][stageNumber - 1],
    lowTableWeight: 80,
    highTableWeight: 20,
    prizes: [
      {
        rewardCode: 'A',
        name: 'A Prize',
        amountPoints: 0,
        lowWeight: 500,
        highWeight: 120,
        prizeWeight: 120,
        sortOrder: 1,
      },
      {
        rewardCode: 'B',
        name: 'B Prize',
        amountPoints: stageNumber * 100,
        lowWeight: 280,
        highWeight: 220,
        prizeWeight: 220,
        sortOrder: 2,
      },
      {
        rewardCode: 'C',
        name: 'C Prize',
        amountPoints: stageNumber * 300,
        lowWeight: 150,
        highWeight: 280,
        prizeWeight: 280,
        sortOrder: 3,
      },
      {
        rewardCode: 'D',
        name: 'D Prize',
        amountPoints: stageNumber * 700,
        lowWeight: 60,
        highWeight: 250,
        prizeWeight: 250,
        sortOrder: 4,
      },
      {
        rewardCode: 'E',
        name: 'E Prize',
        amountPoints: stageNumber * 1500,
        lowWeight: 10,
        highWeight: 130,
        prizeWeight: 130,
        sortOrder: 5,
      },
    ],
  })),
};

@Injectable()
export class ProbabilityService implements OnModuleInit {
  private readonly configPath: string;

  constructor(private readonly configService: ConfigService) {
    const configuredPath = this.configService.get<string>('PROBABILITY_CONFIG_PATH', 'config/probability.json');
    this.configPath = isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath);
  }

  async onModuleInit() {
    await this.ensureConfigFile();
  }

  async getConfig(): Promise<ProbabilityConfigFile> {
    await this.ensureConfigFile();
    const raw = await readFile(this.configPath, 'utf-8');
    const config = JSON.parse(raw) as ProbabilityConfigFile;
    return this.normalizeConfig(config);
  }

  async getStages(): Promise<ProbabilityStageConfig[]> {
    return (await this.getConfig()).stages;
  }

  async getStageThresholds(): Promise<StageThreshold[]> {
    return (await this.getStages()).map((stage) => ({
      stageNumber: stage.stageNumber,
      turnoverThresholdPoints: stage.turnoverThresholdPoints,
    }));
  }

  async getPrizesForStage(stageNumber: number): Promise<ProbabilityPrizeConfig[]> {
    return (await this.getDrawConfigForStage(stageNumber)).prizes;
  }

  async getDrawConfigForStage(stageNumber: number): Promise<StageDrawConfig> {
    const stage = (await this.getStages()).find((item) => item.stageNumber === stageNumber);

    if (!stage) {
      throw new BadRequestException(`Stage ${stageNumber} is not configured.`);
    }

    return {
      stage,
      prizes: stage.prizes,
    };
  }

  drawPrizeFromConfig(config: StageDrawConfig, rng = Math.random): DrawPrizeResult {
    const table = pickProbabilityTable(config.stage.lowTableWeight, config.stage.highTableWeight, rng);
    return this.drawPrizeFromConfigForTable(config, table, rng);
  }

  drawPrizeFromConfigForTable(config: StageDrawConfig, table: ProbabilityTable, rng = Math.random): DrawPrizeResult {
    const prize = pickWeightedItem(
      config.prizes,
      (item) => this.getPrizeWeightForTable(item, table),
      rng,
    );

    return { table, prize };
  }

  async drawPrize(stageNumber: number, rng = Math.random): Promise<DrawPrizeResult> {
    return this.drawPrizeFromConfig(await this.getDrawConfigForStage(stageNumber), rng);
  }

  async drawPrizeForTable(stageNumber: number, table: ProbabilityTable, rng = Math.random): Promise<DrawPrizeResult> {
    return this.drawPrizeFromConfigForTable(await this.getDrawConfigForStage(stageNumber), table, rng);
  }

  async replaceConfig(config: ProbabilityConfigFile): Promise<ProbabilityStageConfig[]> {
    const sortedConfig = this.normalizeConfig(config);

    await this.writeConfig(sortedConfig);

    return sortedConfig.stages;
  }

  normalizeConfig(config: ProbabilityConfigFile): ProbabilityConfigFile {
    const normalizedConfig = this.withLegacyPrizeWeights(config);
    this.assertValidConfig(normalizedConfig);
    return this.sortConfig(normalizedConfig);
  }

  private async ensureConfigFile() {
    try {
      await readFile(this.configPath, 'utf-8');
    } catch {
      await this.writeConfig(DEFAULT_CONFIG);
    }
  }

  private async writeConfig(config: ProbabilityConfigFile) {
    await mkdir(dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  }

  private sortConfig(config: ProbabilityConfigFile): ProbabilityConfigFile {
    return {
      ...config,
      stages: [...config.stages]
        .sort((a, b) => a.stageNumber - b.stageNumber)
        .map((stage) => ({
          ...stage,
          prizes: [...stage.prizes].sort((a, b) => a.sortOrder - b.sortOrder || a.rewardCode.localeCompare(b.rewardCode)),
        })),
    };
  }

  private withLegacyPrizeWeights(config: ProbabilityConfigFile): ProbabilityConfigFile {
    return {
      ...config,
      stages: config.stages?.map((stage) => ({
        ...stage,
        prizes: stage.prizes?.map((prize) => ({
          ...prize,
          prizeWeight: prize.prizeWeight ?? prize.highWeight,
        })),
      })),
    };
  }

  private getPrizeWeightForTable(prize: ProbabilityPrizeConfig, table: ProbabilityTable): number {
    if (table === 'low') {
      return prize.lowWeight;
    }

    if (table === 'high') {
      return prize.highWeight;
    }

    return prize.prizeWeight;
  }

  private assertValidConfig(config: ProbabilityConfigFile) {
    if (!Array.isArray(config.stages) || config.stages.length !== 5) {
      throw new BadRequestException('Probability config must define exactly five stages.');
    }

    const stageNumbers = config.stages.map((stage) => stage.stageNumber);

    if (new Set(stageNumbers).size !== 5 || ![1, 2, 3, 4, 5].every((stageNumber) => stageNumbers.includes(stageNumber))) {
      throw new BadRequestException('Probability config stages must be numbered 1 through 5.');
    }

    for (const stage of config.stages) {
      this.assertValidStage(stage);
    }
  }

  private assertValidStage(stage: ProbabilityStageConfig) {
    if (stage.turnoverThresholdPoints < 0 || stage.lowTableWeight < 0 || stage.highTableWeight < 0) {
      throw new BadRequestException(`Stage ${stage.stageNumber} contains negative numeric values.`);
    }

    const rewardCodes = stage.prizes.map((prize) => prize.rewardCode);

    if (rewardCodes.length !== 5 || new Set(rewardCodes).size !== 5 || !REWARD_CODES.every((code) => rewardCodes.includes(code))) {
      throw new BadRequestException(`Stage ${stage.stageNumber} must define rewards A through E.`);
    }

    if (stage.lowTableWeight + stage.highTableWeight <= 0) {
      throw new BadRequestException(`Stage ${stage.stageNumber} needs low/high table split weight.`);
    }

    if (!stage.prizes.some((prize) => prize.lowWeight > 0)) {
      throw new BadRequestException(`Stage ${stage.stageNumber} low table needs at least one weighted prize.`);
    }

    if (!stage.prizes.some((prize) => prize.highWeight > 0)) {
      throw new BadRequestException(`Stage ${stage.stageNumber} high table needs at least one weighted prize.`);
    }

    if (!stage.prizes.some((prize) => prize.prizeWeight > 0)) {
      throw new BadRequestException(`Stage ${stage.stageNumber} prize table needs at least one weighted prize.`);
    }

    for (const prize of stage.prizes) {
      if (prize.amountPoints < 0 || prize.lowWeight < 0 || prize.highWeight < 0 || prize.prizeWeight < 0) {
        throw new BadRequestException(`Stage ${stage.stageNumber} reward ${prize.rewardCode} contains negative numeric values.`);
      }
    }
  }
}
