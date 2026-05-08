import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'path';
import { StageThreshold } from '../domain/stage-progress';
import { pickProbabilityTable, pickWeightedItem } from './probability-picker';
import {
  DrawPrizeResult,
  ProbabilityConfigFile,
  ProbabilityImportDiffItem,
  ProbabilityImportPreview,
  ProbabilityPrizeConfig,
  ProbabilityStageConfig,
  StageDrawConfig,
} from './probability-config.types';
import { parseProbabilityXlsxZip } from './probability-xlsx.parser';
import { UpdateStagesDto } from './dto/update-stages.dto';

const REWARD_CODES = ['A', 'B', 'C', 'D', 'E'];
const DIFF_FIELD_LABELS: Record<string, string> = {
  turnoverThresholdPoints: '流水門檻',
  lowTableWeight: 'Low 表分流權重',
  highTableWeight: 'High 表分流權重',
  name: '獎項名稱',
  amountPoints: '獎勵點數',
  lowWeight: 'Low 權重',
  highWeight: 'High 權重',
  sortOrder: '排序',
};

export interface ProbabilityImportUpload {
  id: string;
  originalFilename: string;
  storedFilename: string;
  fileSize: number;
  uploadedAt: string;
}

export interface ProbabilityImportFile {
  path: string;
  metadata: ProbabilityImportUpload;
}

type ProbabilityZipFile = {
  buffer: Buffer;
  originalname: string;
  size: number;
};

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
        sortOrder: 1,
      },
      {
        rewardCode: 'B',
        name: 'B Prize',
        amountPoints: stageNumber * 100,
        lowWeight: 280,
        highWeight: 220,
        sortOrder: 2,
      },
      {
        rewardCode: 'C',
        name: 'C Prize',
        amountPoints: stageNumber * 300,
        lowWeight: 150,
        highWeight: 280,
        sortOrder: 3,
      },
      {
        rewardCode: 'D',
        name: 'D Prize',
        amountPoints: stageNumber * 700,
        lowWeight: 60,
        highWeight: 250,
        sortOrder: 4,
      },
      {
        rewardCode: 'E',
        name: 'E Prize',
        amountPoints: stageNumber * 1500,
        lowWeight: 10,
        highWeight: 130,
        sortOrder: 5,
      },
    ],
  })),
};

@Injectable()
export class ProbabilityService implements OnModuleInit {
  private readonly configPath: string;
  private readonly importStoragePath: string;

  constructor(private readonly configService: ConfigService) {
    const configuredPath = this.configService.get<string>('PROBABILITY_CONFIG_PATH', 'config/probability.json');
    this.configPath = isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath);
    const configuredImportStoragePath = this.configService.get<string>(
      'PROBABILITY_IMPORT_STORAGE_PATH',
      '../storage/probability-imports',
    );
    this.importStoragePath = isAbsolute(configuredImportStoragePath)
      ? configuredImportStoragePath
      : resolve(process.cwd(), configuredImportStoragePath);
  }

  async onModuleInit() {
    await this.ensureConfigFile();
  }

  async getConfig(): Promise<ProbabilityConfigFile> {
    await this.ensureConfigFile();
    const raw = await readFile(this.configPath, 'utf-8');
    const config = JSON.parse(raw) as ProbabilityConfigFile;
    this.assertValidConfig(config);
    return this.sortConfig(config);
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
    const prize = pickWeightedItem(
      config.prizes,
      (item) => (table === 'low' ? item.lowWeight : item.highWeight),
      rng,
    );

    return { table, prize };
  }

  async drawPrize(stageNumber: number, rng = Math.random): Promise<DrawPrizeResult> {
    return this.drawPrizeFromConfig(await this.getDrawConfigForStage(stageNumber), rng);
  }

  async updateStages(dto: UpdateStagesDto): Promise<ProbabilityStageConfig[]> {
    const config: ProbabilityConfigFile = {
      version: 1,
      stages: dto.stages,
    };
    this.assertValidConfig(config);
    await this.writeConfig(this.sortConfig(config));
    return this.getStages();
  }

  async previewImportZip(file: ProbabilityZipFile): Promise<ProbabilityImportPreview & { upload: ProbabilityImportUpload }> {
    const proposedConfig = this.parseImportZip(file);
    const upload = await this.storeImportZip(file);
    const currentConfig = await this.getConfig();

    return {
      filename: file.originalname,
      upload,
      diff: this.buildConfigDiff(currentConfig, proposedConfig),
      proposedConfig,
    };
  }

  async applyImportUpload(uploadId: string): Promise<{
    upload: ProbabilityImportUpload;
    diff: ProbabilityImportDiffItem[];
    stages: ProbabilityStageConfig[];
  }> {
    const importFile = await this.getImportFile(uploadId);
    const buffer = await readFile(importFile.path);
    const proposedConfig = this.parseImportZip({
      buffer,
      originalname: importFile.metadata.originalFilename,
      size: importFile.metadata.fileSize,
    });
    const currentConfig = await this.getConfig();
    const sortedConfig = this.sortConfig(proposedConfig);

    await this.writeConfig(sortedConfig);

    return {
      upload: importFile.metadata,
      diff: this.buildConfigDiff(currentConfig, sortedConfig),
      stages: sortedConfig.stages,
    };
  }

  async listImportUploads(): Promise<ProbabilityImportUpload[]> {
    await mkdir(this.importStoragePath, { recursive: true });
    const files = await readdir(this.importStoragePath);
    const metadataFiles = files.filter((file) => file.endsWith('.json'));
    const uploads = await Promise.all(
      metadataFiles.map(async (file) => JSON.parse(await readFile(join(this.importStoragePath, file), 'utf-8')) as ProbabilityImportUpload),
    );

    return uploads.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }

  async getImportFile(uploadId: string): Promise<ProbabilityImportFile> {
    if (!uploadId || !/^[a-zA-Z0-9-]+$/.test(uploadId)) {
      throw new BadRequestException('Invalid probability import id.');
    }

    const metadataPath = join(this.importStoragePath, `${uploadId}.json`);
    const metadata = JSON.parse(await readFile(metadataPath, 'utf-8')) as ProbabilityImportUpload;
    const path = join(this.importStoragePath, metadata.storedFilename);

    return { path, metadata };
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

  private parseImportZip(file: ProbabilityZipFile): ProbabilityConfigFile {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Probability zip file is required.');
    }

    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Probability import file must be a .zip archive.');
    }

    try {
      const config = this.sortConfig(parseProbabilityXlsxZip(file.buffer));
      this.assertValidConfig(config);
      return config;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parser error.';
      throw new BadRequestException(`Failed to parse probability zip: ${message}`);
    }
  }

  private async storeImportZip(file: ProbabilityZipFile): Promise<ProbabilityImportUpload> {
    await mkdir(this.importStoragePath, { recursive: true });
    const id = `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${randomUUID().slice(0, 8)}`;
    const storedFilename = `${id}.zip`;
    const metadata: ProbabilityImportUpload = {
      id,
      originalFilename: basename(file.originalname),
      storedFilename,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    };

    await writeFile(join(this.importStoragePath, storedFilename), file.buffer);
    await writeFile(join(this.importStoragePath, `${id}.json`), `${JSON.stringify(metadata, null, 2)}\n`, 'utf-8');

    return metadata;
  }

  private buildConfigDiff(current: ProbabilityConfigFile, proposed: ProbabilityConfigFile): ProbabilityImportDiffItem[] {
    const diff: ProbabilityImportDiffItem[] = [];
    const currentStages = new Map(current.stages.map((stage) => [stage.stageNumber, stage]));

    for (const proposedStage of proposed.stages) {
      const currentStage = currentStages.get(proposedStage.stageNumber);
      if (!currentStage) {
        diff.push({
          key: `stage-${proposedStage.stageNumber}-new`,
          stageNumber: proposedStage.stageNumber,
          field: 'stage',
          label: `Stage ${proposedStage.stageNumber} 新增`,
          before: null,
          after: '新增階段',
        });
        continue;
      }

      this.pushDiff(diff, proposedStage.stageNumber, undefined, 'turnoverThresholdPoints', currentStage.turnoverThresholdPoints, proposedStage.turnoverThresholdPoints);
      this.pushDiff(diff, proposedStage.stageNumber, undefined, 'lowTableWeight', currentStage.lowTableWeight, proposedStage.lowTableWeight);
      this.pushDiff(diff, proposedStage.stageNumber, undefined, 'highTableWeight', currentStage.highTableWeight, proposedStage.highTableWeight);

      const currentPrizes = new Map(currentStage.prizes.map((prize) => [prize.rewardCode, prize]));
      for (const proposedPrize of proposedStage.prizes) {
        const currentPrize = currentPrizes.get(proposedPrize.rewardCode);
        if (!currentPrize) {
          diff.push({
            key: `stage-${proposedStage.stageNumber}-prize-${proposedPrize.rewardCode}-new`,
            stageNumber: proposedStage.stageNumber,
            rewardCode: proposedPrize.rewardCode,
            field: 'prize',
            label: `Stage ${proposedStage.stageNumber} / ${proposedPrize.rewardCode} 獎 新增`,
            before: null,
            after: proposedPrize.name,
          });
          continue;
        }

        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'name', currentPrize.name, proposedPrize.name);
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'amountPoints', currentPrize.amountPoints, proposedPrize.amountPoints);
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'lowWeight', currentPrize.lowWeight, proposedPrize.lowWeight);
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'highWeight', currentPrize.highWeight, proposedPrize.highWeight);
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'sortOrder', currentPrize.sortOrder, proposedPrize.sortOrder);
      }
    }

    return diff;
  }

  private pushDiff(
    diff: ProbabilityImportDiffItem[],
    stageNumber: number,
    rewardCode: string | undefined,
    field: string,
    before: string | number,
    after: string | number,
  ) {
    if (before === after) {
      return;
    }

    diff.push({
      key: `stage-${stageNumber}-${rewardCode ?? 'stage'}-${field}`,
      stageNumber,
      rewardCode,
      field,
      label: rewardCode
        ? `Stage ${stageNumber} / ${rewardCode} 獎 / ${DIFF_FIELD_LABELS[field] ?? field}`
        : `Stage ${stageNumber} / ${DIFF_FIELD_LABELS[field] ?? field}`,
      before,
      after,
    });
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

    for (const prize of stage.prizes) {
      if (prize.amountPoints < 0 || prize.lowWeight < 0 || prize.highWeight < 0) {
        throw new BadRequestException(`Stage ${stage.stageNumber} reward ${prize.rewardCode} contains negative numeric values.`);
      }
    }
  }
}
