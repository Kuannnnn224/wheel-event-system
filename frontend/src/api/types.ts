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
  enabled: boolean;
  sortOrder: number;
}

export interface StageConfig {
  id?: number;
  stageNumber: number;
  turnoverThresholdPoints: number;
  lowTableWeight: number;
  highTableWeight: number;
  enabled: boolean;
  prizes: PrizeConfig[];
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
  prizeResults: Array<{
    probabilityTable: 'low' | 'high';
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
