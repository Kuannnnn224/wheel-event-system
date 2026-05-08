import { ProbabilityTable } from './probability-picker';

export interface ProbabilityPrizeConfig {
  rewardCode: string;
  name: string;
  amountPoints: number;
  lowWeight: number;
  highWeight: number;
  enabled: boolean;
  sortOrder: number;
}

export interface ProbabilityStageConfig {
  stageNumber: number;
  turnoverThresholdPoints: number;
  enabled: boolean;
  lowTableWeight: number;
  highTableWeight: number;
  prizes: ProbabilityPrizeConfig[];
}

export interface ProbabilityConfigFile {
  version: number;
  stages: ProbabilityStageConfig[];
}

export interface DrawPrizeResult {
  table: ProbabilityTable;
  prize: ProbabilityPrizeConfig;
}

export interface StageDrawConfig {
  stage: ProbabilityStageConfig;
  prizes: ProbabilityPrizeConfig[];
}
