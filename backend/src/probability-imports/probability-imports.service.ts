import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { basename, isAbsolute, join, resolve } from 'path';
import { ProbabilityConfigFile } from '../probability/probability-config.types';
import { ProbabilityService } from '../probability/probability.service';
import { parseProbabilityXlsxZip } from './probability-xlsx.parser';
import {
  ProbabilityImportDiffItem,
  ProbabilityImportFile,
  ProbabilityImportPreview,
  ProbabilityImportUpload,
  ProbabilityZipFile,
  ProbabilityDownloadToken,
} from './probability-imports.types';

const DIFF_FIELD_LABELS: Record<string, string> = {
  turnoverThresholdPoints: '流水門檻',
  lowTableWeight: 'Low 表分流權重',
  highTableWeight: 'High 表分流權重',
  name: '獎項名稱',
  amountPoints: '獎勵點數',
  lowWeight: 'Low 權重',
  highWeight: 'High 權重',
  prizeWeight: 'Prize 權重',
  sortOrder: '排序',
};

@Injectable()
export class ProbabilityImportsService {
  private readonly importStoragePath: string;
  private readonly downloadTokens = new Map<string, { uploadId: string; expiresAt: number }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly probabilityService: ProbabilityService,
  ) {
    const configuredImportStoragePath = this.configService.get<string>(
      'PROBABILITY_IMPORT_STORAGE_PATH',
      '../storage/probability-imports',
    );
    this.importStoragePath = isAbsolute(configuredImportStoragePath)
      ? configuredImportStoragePath
      : resolve(process.cwd(), configuredImportStoragePath);
  }

  async previewImportZip(file: ProbabilityZipFile): Promise<ProbabilityImportPreview> {
    const proposedConfig = this.parseImportZip(file);
    const upload = await this.storeImportZip(file);
    const currentConfig = await this.probabilityService.getConfig();

    return {
      filename: file.originalname,
      upload,
      diff: this.buildConfigDiff(currentConfig, proposedConfig),
      proposedConfig,
    };
  }

  async applyImportUpload(uploadId: string) {
    const importFile = await this.getImportFile(uploadId);
    const buffer = await readFile(importFile.path);
    const proposedConfig = this.parseImportZip({
      buffer,
      originalname: importFile.metadata.originalFilename,
      size: importFile.metadata.fileSize,
    });
    const currentConfig = await this.probabilityService.getConfig();
    const stages = await this.probabilityService.replaceConfig(proposedConfig);

    return {
      upload: importFile.metadata,
      diff: this.buildConfigDiff(currentConfig, { version: 1, stages }),
      stages,
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

  async createDownloadToken(uploadId: string): Promise<ProbabilityDownloadToken> {
    await this.getImportFile(uploadId);
    const token = randomUUID();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    this.downloadTokens.set(token, { uploadId, expiresAt });

    return {
      token,
      downloadUrl: `/probability/imports/download/${token}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async getImportFileByDownloadToken(token: string): Promise<ProbabilityImportFile> {
    const tokenInfo = this.downloadTokens.get(token);

    if (!tokenInfo || tokenInfo.expiresAt < Date.now()) {
      this.downloadTokens.delete(token);
      throw new BadRequestException('Probability import download link is expired.');
    }

    return this.getImportFile(tokenInfo.uploadId);
  }

  private parseImportZip(file: ProbabilityZipFile): ProbabilityConfigFile {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Probability zip file is required.');
    }

    if (!file.originalname.toLowerCase().endsWith('.zip')) {
      throw new BadRequestException('Probability import file must be a .zip archive.');
    }

    try {
      return this.probabilityService.normalizeConfig(parseProbabilityXlsxZip(file.buffer));
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
        this.pushDiff(diff, proposedStage.stageNumber, proposedPrize.rewardCode, 'prizeWeight', currentPrize.prizeWeight, proposedPrize.prizeWeight);
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
}
