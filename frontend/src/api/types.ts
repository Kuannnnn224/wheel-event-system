export interface Player {
  id: string;
  createdAt: number;
  updatedAt: number;
}

export type ProbabilityTable = 'low' | 'high' | 'prize' | 'dailyLimit';

export interface PrizeConfig {
  id?: number;
  rewardCode: string;
  name: string;
  lowWeight: number;
  highWeight: number;
  prizeWeight: number;
  dailyLimitWeight: number;
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
  proposedConfig: ProbabilityConfig;
}

export interface ProbabilityConfig {
  version: number;
  dailyPayoutLimitPoints: number;
  stages: StageConfig[];
}

export interface SpinRecord {
  id: string;
  playerId: string;
  businessDate: string;
  stageNumber: number;
  probabilityTable: ProbabilityTable;
  prizeName: string;
  amountPoints: number;
  createdAt: number;
}

export interface AwardOverrideRule {
  id: string;
  playerId: string;
  player?: {
    id: string;
  };
  businessDate: string;
  stageNumber: number;
  status: 'pending' | 'consumed' | 'cancelled';
  reason?: string;
  createdByAdminId?: string;
  cancelledByAdminId?: string;
  consumedSpinRecordId?: string;
  consumedSpinRecord?: SpinRecord | null;
  createdAt: number;
  updatedAt: number;
  consumedAt?: number;
  cancelledAt?: number;
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

export interface DailyReport {
  businessDate: string;
  totalSpins: number;
  uniquePlayers: number;
  totalAmountPoints: number;
  dailyPayoutLimitPoints: number;
  dailyLimitActive: boolean;
  byStage: Array<{ stageNumber: number; spinCount: number; totalAmountPoints: number }>;
}

export interface RangeReport {
  startDate: string;
  endDate: string;
  totalSpins: number;
  uniquePlayers: number;
  totalAmountPoints: number;
  byStage: Array<{ stageNumber: number; spinCount: number; totalAmountPoints: number }>;
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
    probabilityTable: ProbabilityTable;
    count: number;
  }>;
  prizeResults: Array<{
    probabilityTable?: ProbabilityTable;
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
