import { ProbabilityConfigFile } from '../probability/probability-config.types';

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

export interface ProbabilityImportDiffItem {
  key: string;
  stageNumber: number;
  rewardCode?: string;
  field: string;
  label: string;
  before: string | number | null;
  after: string | number | null;
}

export interface ProbabilityImportPreview {
  filename: string;
  upload: ProbabilityImportUpload;
  diff: ProbabilityImportDiffItem[];
  proposedConfig: ProbabilityConfigFile;
}

export type ProbabilityZipFile = {
  buffer: Buffer;
  originalname: string;
  size: number;
};

export interface ProbabilityDownloadToken {
  token: string;
  downloadUrl: string;
  expiresAt: string;
}
