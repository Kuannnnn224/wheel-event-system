export interface Player {
  id: string;
  externalId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrizeConfig {
  id?: number;
  rewardCode: string;
  name: string;
  lowWeight: number;
  highWeight: number;
  amountPoints: number;
  sortOrder: number;
}

export interface StageConfig {
  id?: number;
  stageNumber: number;
  turnoverThresholdPoints: number;
  lowTableWeight: number;
  highTableWeight: number;
  prizes: PrizeConfig[];
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

export interface ProbabilityImportUpload {
  id: string;
  originalFilename: string;
  storedFilename: string;
  fileSize: number;
  uploadedAt: string;
}

export interface ProbabilityImportPreview {
  filename: string;
  upload: ProbabilityImportUpload;
  diff: ProbabilityImportDiffItem[];
  proposedConfig: {
    version: number;
    stages: StageConfig[];
  };
}

export interface SpinRecord {
  id: string;
  playerId: string;
  businessDate: string;
  stageNumber: number;
  probabilityTable: 'low' | 'high';
  prizeName: string;
  amountPoints: number;
  createdAt: string;
}

export interface PlayerDailyProgress {
  player: Player;
  businessDate: string;
  turnoverPoints: number;
  unlockedStage: number;
  playedStages: number[];
  totalWinPoints: number;
  spins: SpinRecord[];
}

export interface SimulationJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  stageNumber: number;
  requestedCount: number;
  completedCount: number;
  progressPercent: number;
  totalAmountPoints: number;
  averageAmountPoints: number;
  tableResults: Array<{
    probabilityTable: 'low' | 'high';
    count: number;
  }>;
  prizeResults: Array<{
    probabilityTable?: 'low' | 'high';
    rewardCode: string;
    name: string;
    amountPoints: number;
    count: number;
    totalAmountPoints: number;
  }>;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  elapsedMs?: number;
}
