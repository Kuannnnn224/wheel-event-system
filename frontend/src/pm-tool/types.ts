export type ProbabilityTable = 'low' | 'high' | 'prize' | 'dailyLimit';
export type DrawMode = 'split' | ProbabilityTable;

export interface PrizeConfig {
  rewardCode: string;
  name: string;
  amountPoints: number;
  lowWeight: number;
  highWeight: number;
  prizeWeight: number;
  dailyLimitWeight: number;
  sortOrder: number;
}

export interface StageConfig {
  stageNumber: number;
  turnoverThresholdPoints: number;
  lowTableWeight: number;
  highTableWeight: number;
  prizes: PrizeConfig[];
}

export interface ProbabilityConfig {
  version: number;
  dailyPayoutLimitPoints: number;
  stages: StageConfig[];
}

export interface DrawResult {
  table: ProbabilityTable;
  prize: PrizeConfig;
}

export interface PrizeSimulationResult {
  rewardCode: string;
  name: string;
  amountPoints: number;
  count: number;
  totalAmountPoints: number;
}

export interface SimulationResult {
  count: number;
  totalAmountPoints: number;
  averageAmountPoints: number;
  tableCounts: Record<ProbabilityTable, number>;
  prizes: PrizeSimulationResult[];
  elapsedMs: number;
}
