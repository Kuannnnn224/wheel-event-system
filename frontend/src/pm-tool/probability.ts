import type {
  DrawMode,
  DrawResult,
  ProbabilityConfig,
  ProbabilityTable,
  PrizeConfig,
  SimulationResult,
  StageConfig,
} from './types';

const REWARD_CODES = ['A', 'B', 'C', 'D', 'E'];
const PROBABILITY_TABLES: ProbabilityTable[] = ['low', 'high', 'prize', 'dailyLimit'];

export function cloneConfig(config: ProbabilityConfig): ProbabilityConfig {
  return {
    ...config,
    stages: config.stages.map((stage) => ({
      ...stage,
      prizes: stage.prizes.map((prize) => ({ ...prize })),
    })),
  };
}

export function formatRate(value: number, total = 1, digits = 2) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) {
    return `${(0).toFixed(digits)}%`;
  }

  return `${((value / total) * 100).toFixed(digits)}%`;
}

export function getTableWeight(prize: PrizeConfig, table: ProbabilityTable) {
  if (table === 'low') {
    return prize.lowWeight;
  }

  if (table === 'high') {
    return prize.highWeight;
  }

  if (table === 'dailyLimit') {
    return prize.dailyLimitWeight;
  }

  return prize.prizeWeight;
}

export function getPrizeWeightTotal(stage: StageConfig, table: ProbabilityTable) {
  return stage.prizes.reduce((sum, prize) => sum + getTableWeight(prize, table), 0);
}

export function getSplitRate(stage: StageConfig, table: 'low' | 'high') {
  const total = stage.lowTableWeight + stage.highTableWeight;

  if (total <= 0) {
    return 0;
  }

  return (table === 'low' ? stage.lowTableWeight : stage.highTableWeight) / total;
}

export function getOverallPrizeRate(stage: StageConfig, prize: PrizeConfig) {
  const lowTotal = getPrizeWeightTotal(stage, 'low');
  const highTotal = getPrizeWeightTotal(stage, 'high');
  const lowRate = lowTotal > 0 ? (prize.lowWeight / lowTotal) * getSplitRate(stage, 'low') : 0;
  const highRate = highTotal > 0 ? (prize.highWeight / highTotal) * getSplitRate(stage, 'high') : 0;
  return lowRate + highRate;
}

export function getExpectedAmountPoints(stage: StageConfig, mode: DrawMode) {
  if (mode === 'split') {
    return stage.prizes.reduce((sum, prize) => sum + prize.amountPoints * getOverallPrizeRate(stage, prize), 0);
  }

  const total = getPrizeWeightTotal(stage, mode);
  return stage.prizes.reduce((sum, prize) => {
    const weight = getTableWeight(prize, mode);
    return sum + prize.amountPoints * (total > 0 ? weight / total : 0);
  }, 0);
}

export function pickWeightedItem<T>(items: T[], getWeight: (item: T) => number, rng = Math.random): T {
  const weightedItems = items.filter((item) => getWeight(item) > 0);
  const totalWeight = weightedItems.reduce((sum, item) => sum + getWeight(item), 0);

  if (totalWeight <= 0) {
    throw new Error('至少需要一個正權重項目。');
  }

  let roll = rng() * totalWeight;

  for (const item of weightedItems) {
    roll -= getWeight(item);
    if (roll < 0) {
      return item;
    }
  }

  return weightedItems[weightedItems.length - 1];
}

export function drawPrize(stage: StageConfig, mode: DrawMode, rng = Math.random): DrawResult {
  const table =
    mode === 'split'
      ? pickWeightedItem(
          [
            { table: 'low' as const, weight: stage.lowTableWeight },
            { table: 'high' as const, weight: stage.highTableWeight },
          ],
          (item) => item.weight,
          rng,
        ).table
      : mode;
  const prize = pickWeightedItem(stage.prizes, (item) => getTableWeight(item, table), rng);
  return { table, prize };
}

export function createEmptySimulationResult(): SimulationResult {
  return {
    count: 0,
    totalAmountPoints: 0,
    averageAmountPoints: 0,
    tableCounts: {
      low: 0,
      high: 0,
      prize: 0,
      dailyLimit: 0,
    },
    prizes: [],
    elapsedMs: 0,
  };
}

export function addDrawToSimulation(result: SimulationResult, draw: DrawResult) {
  result.count += 1;
  result.tableCounts[draw.table] += 1;
  result.totalAmountPoints += draw.prize.amountPoints;
  result.averageAmountPoints = result.totalAmountPoints / result.count;

  const key = `${draw.prize.rewardCode}:${draw.prize.name}:${draw.prize.amountPoints}`;
  const existing = result.prizes.find((item) => `${item.rewardCode}:${item.name}:${item.amountPoints}` === key);

  if (existing) {
    existing.count += 1;
    existing.totalAmountPoints += draw.prize.amountPoints;
  } else {
    result.prizes.push({
      rewardCode: draw.prize.rewardCode,
      name: draw.prize.name,
      amountPoints: draw.prize.amountPoints,
      count: 1,
      totalAmountPoints: draw.prize.amountPoints,
    });
  }

  result.prizes.sort((a, b) => a.rewardCode.localeCompare(b.rewardCode));
}

export function normalizeProbabilityConfig(input: unknown): ProbabilityConfig {
  if (!isRecord(input)) {
    throw new Error('機率表必須是 JSON 物件。');
  }

  const config: ProbabilityConfig = {
    version: toInteger(input.version ?? 1, 'version'),
    dailyPayoutLimitPoints: toInteger(input.dailyPayoutLimitPoints ?? 0, 'dailyPayoutLimitPoints'),
    stages: asArray(input.stages, 'stages').map(normalizeStage),
  };

  assertValidConfig(config);
  return sortConfig(config);
}

export function getValidationErrors(config: ProbabilityConfig) {
  try {
    assertValidConfig(config);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : '機率表格式錯誤。'];
  }
}

function normalizeStage(input: unknown): StageConfig {
  if (!isRecord(input)) {
    throw new Error('stage 必須是 JSON 物件。');
  }

  return {
    stageNumber: toInteger(input.stageNumber, 'stageNumber'),
    turnoverThresholdPoints: toInteger(input.turnoverThresholdPoints, 'turnoverThresholdPoints'),
    lowTableWeight: toInteger(input.lowTableWeight, 'lowTableWeight'),
    highTableWeight: toInteger(input.highTableWeight, 'highTableWeight'),
    prizes: asArray(input.prizes, 'prizes').map(normalizePrize),
  };
}

function normalizePrize(input: unknown): PrizeConfig {
  if (!isRecord(input)) {
    throw new Error('prize 必須是 JSON 物件。');
  }

  const lowWeight = toInteger(input.lowWeight, 'lowWeight');
  const highWeight = toInteger(input.highWeight, 'highWeight');

  return {
    rewardCode: String(input.rewardCode ?? '').trim(),
    name: String(input.name ?? '').trim(),
    amountPoints: toInteger(input.amountPoints, 'amountPoints'),
    lowWeight,
    highWeight,
    prizeWeight: toInteger(input.prizeWeight ?? highWeight, 'prizeWeight'),
    dailyLimitWeight: toInteger(input.dailyLimitWeight ?? lowWeight, 'dailyLimitWeight'),
    sortOrder: toInteger(input.sortOrder, 'sortOrder'),
  };
}

function assertValidConfig(config: ProbabilityConfig) {
  if (!Array.isArray(config.stages) || config.stages.length !== 5) {
    throw new Error('機率表必須設定 5 個 Stage。');
  }

  if (config.dailyPayoutLimitPoints < 0) {
    throw new Error('每日送出上限不可小於 0。');
  }

  const stageNumbers = config.stages.map((stage) => stage.stageNumber);
  if (new Set(stageNumbers).size !== 5 || ![1, 2, 3, 4, 5].every((stageNumber) => stageNumbers.includes(stageNumber))) {
    throw new Error('Stage 必須剛好是 1 到 5。');
  }

  for (const stage of config.stages) {
    assertValidStage(stage);
  }
}

function assertValidStage(stage: StageConfig) {
  if (stage.turnoverThresholdPoints < 0 || stage.lowTableWeight < 0 || stage.highTableWeight < 0) {
    throw new Error(`Stage ${stage.stageNumber} 的門檻與分流權重不可小於 0。`);
  }

  if (stage.lowTableWeight + stage.highTableWeight <= 0) {
    throw new Error(`Stage ${stage.stageNumber} 需要 Low/High 分流權重。`);
  }

  const rewardCodes = stage.prizes.map((prize) => prize.rewardCode);
  if (rewardCodes.length !== 5 || new Set(rewardCodes).size !== 5 || !REWARD_CODES.every((code) => rewardCodes.includes(code))) {
    throw new Error(`Stage ${stage.stageNumber} 必須設定 A 到 E 五個獎項。`);
  }

  for (const table of PROBABILITY_TABLES) {
    if (!stage.prizes.some((prize) => getTableWeight(prize, table) > 0)) {
      throw new Error(`Stage ${stage.stageNumber} 的 ${table} 表至少需要一個正權重獎項。`);
    }
  }

  for (const prize of stage.prizes) {
    if (!prize.name) {
      throw new Error(`Stage ${stage.stageNumber} ${prize.rewardCode} 獎項名稱不可為空。`);
    }

    if (
      prize.amountPoints < 0 ||
      prize.lowWeight < 0 ||
      prize.highWeight < 0 ||
      prize.prizeWeight < 0 ||
      prize.dailyLimitWeight < 0 ||
      prize.sortOrder < 0
    ) {
      throw new Error(`Stage ${stage.stageNumber} ${prize.rewardCode} 有小於 0 的數值。`);
    }
  }
}

function sortConfig(config: ProbabilityConfig): ProbabilityConfig {
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

function asArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} 必須是陣列。`);
  }

  return value;
}

function toInteger(value: unknown, label: string) {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue)) {
    throw new Error(`${label} 必須是整數。`);
  }

  return numberValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
