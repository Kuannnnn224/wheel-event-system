import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { normalizeProbabilityConfig } from './probability';
import type { ProbabilityConfig, PrizeConfig } from './types';

type CellValue = string | number | boolean | Date | null | undefined;
type SheetRows = CellValue[][];

const REWARD_CODES = ['A', 'B', 'C', 'D', 'E'];
const REQUIRED_FILES = ['config.xlsx', 'low.xlsx', 'high.xlsx', 'prize.xlsx', 'daily-limit.xlsx', 'weight.xlsx'];
const STAGE_TEXT_MAP = new Map([
  ['一', 1],
  ['二', 2],
  ['三', 3],
  ['四', 4],
  ['五', 5],
]);

interface ProbabilitySourceWorkbooks {
  configWorkbook: XLSX.WorkBook;
  lowWorkbook: XLSX.WorkBook;
  highWorkbook: XLSX.WorkBook;
  prizeWorkbook: XLSX.WorkBook;
  dailyLimitWorkbook: XLSX.WorkBook;
  weightWorkbook: XLSX.WorkBook;
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

const DIFF_FIELD_LABELS: Record<string, string> = {
  dailyPayoutLimitPoints: '每日送出上限',
  turnoverThresholdPoints: '流水門檻',
  lowTableWeight: 'Low 表分流權重',
  highTableWeight: 'High 表分流權重',
  name: '獎項名稱',
  amountPoints: '獎勵點數',
  lowWeight: 'Low 權重',
  highWeight: 'High 權重',
  prizeWeight: '指定派獎權重',
  dailyLimitWeight: 'DailyLimit 權重',
  sortOrder: '排序',
};

export async function parseProbabilityZipFile(file: File): Promise<ProbabilityConfig> {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    throw new Error('請上傳 .zip 機率包。');
  }

  return parseProbabilityZipBuffer(await file.arrayBuffer());
}

export async function parseProbabilityZipBuffer(buffer: ArrayBuffer): Promise<ProbabilityConfig> {
  const zip = await JSZip.loadAsync(buffer);
  const files = new Map<string, JSZip.JSZipObject>();

  zip.forEach((entryName, entry) => {
    if (entry.dir) {
      return;
    }

    const fileName = entryName.split(/[\\/]/).pop()?.toLowerCase();
    if (fileName) {
      files.set(fileName, entry);
    }
  });

  const workbookBuffers = await Promise.all(REQUIRED_FILES.map(async (fileName) => requireZipEntry(files, fileName).async('arraybuffer')));

  return normalizeProbabilityConfig(
    parseProbabilityWorkbooks({
      configWorkbook: readWorkbook(workbookBuffers[0]),
      lowWorkbook: readWorkbook(workbookBuffers[1]),
      highWorkbook: readWorkbook(workbookBuffers[2]),
      prizeWorkbook: readWorkbook(workbookBuffers[3]),
      dailyLimitWorkbook: readWorkbook(workbookBuffers[4]),
      weightWorkbook: readWorkbook(workbookBuffers[5]),
    }),
  );
}

export function buildConfigDiff(current: ProbabilityConfig, proposed: ProbabilityConfig): ProbabilityImportDiffItem[] {
  const diff: ProbabilityImportDiffItem[] = [];
  const currentStages = new Map(current.stages.map((stage) => [stage.stageNumber, stage]));

  pushDiff(diff, 0, undefined, 'dailyPayoutLimitPoints', current.dailyPayoutLimitPoints ?? 0, proposed.dailyPayoutLimitPoints ?? 0);

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

    pushDiff(diff, proposedStage.stageNumber, undefined, 'turnoverThresholdPoints', currentStage.turnoverThresholdPoints, proposedStage.turnoverThresholdPoints);
    pushDiff(diff, proposedStage.stageNumber, undefined, 'lowTableWeight', currentStage.lowTableWeight, proposedStage.lowTableWeight);
    pushDiff(diff, proposedStage.stageNumber, undefined, 'highTableWeight', currentStage.highTableWeight, proposedStage.highTableWeight);

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

      pushPrizeDiff(diff, proposedStage.stageNumber, proposedPrize, currentPrize);
    }
  }

  return diff;
}

function pushPrizeDiff(
  diff: ProbabilityImportDiffItem[],
  stageNumber: number,
  proposedPrize: PrizeConfig,
  currentPrize: PrizeConfig,
) {
  pushDiff(diff, stageNumber, proposedPrize.rewardCode, 'name', currentPrize.name, proposedPrize.name);
  pushDiff(diff, stageNumber, proposedPrize.rewardCode, 'amountPoints', currentPrize.amountPoints, proposedPrize.amountPoints);
  pushDiff(diff, stageNumber, proposedPrize.rewardCode, 'lowWeight', currentPrize.lowWeight, proposedPrize.lowWeight);
  pushDiff(diff, stageNumber, proposedPrize.rewardCode, 'highWeight', currentPrize.highWeight, proposedPrize.highWeight);
  pushDiff(diff, stageNumber, proposedPrize.rewardCode, 'prizeWeight', currentPrize.prizeWeight, proposedPrize.prizeWeight);
  pushDiff(diff, stageNumber, proposedPrize.rewardCode, 'dailyLimitWeight', currentPrize.dailyLimitWeight, proposedPrize.dailyLimitWeight);
  pushDiff(diff, stageNumber, proposedPrize.rewardCode, 'sortOrder', currentPrize.sortOrder, proposedPrize.sortOrder);
}

function parseProbabilityWorkbooks(workbooks: ProbabilitySourceWorkbooks): ProbabilityConfig {
  const { thresholds, dailyPayoutLimitPoints } = parseThresholds(workbooks.configWorkbook);
  const tableWeights = parseTableWeights(workbooks.weightWorkbook);

  return {
    version: 1,
    dailyPayoutLimitPoints,
    stages: [1, 2, 3, 4, 5].map((stageNumber) => {
      const split = tableWeights.get(stageNumber);

      if (!split) {
        throw new Error(`Missing low/high split weights for stage ${stageNumber}.`);
      }

      return {
        stageNumber,
        turnoverThresholdPoints: requireNumber(thresholds.get(stageNumber), `stage ${stageNumber} threshold`),
        lowTableWeight: split.low,
        highTableWeight: split.high,
        prizes: parseStagePrizes(workbooks, stageNumber),
      };
    }),
  };
}

function parseStagePrizes(workbooks: ProbabilitySourceWorkbooks, stageNumber: number): PrizeConfig[] {
  const lowWeights = parsePrizeWeights(workbooks.lowWorkbook, stageNumber, 'low');
  const highWeights = parsePrizeWeights(workbooks.highWorkbook, stageNumber, 'high');
  const prizeWeights = parsePrizeWeights(workbooks.prizeWorkbook, stageNumber, 'prize');
  const dailyLimitWeights = parsePrizeWeights(workbooks.dailyLimitWorkbook, stageNumber, 'dailyLimit');

  return parsePrizeAmounts(workbooks.configWorkbook, stageNumber).map((prize) => ({
    ...prize,
    lowWeight: requireNumber(lowWeights.get(prize.rewardCode), `stage ${stageNumber} ${prize.rewardCode} low weight`),
    highWeight: requireNumber(highWeights.get(prize.rewardCode), `stage ${stageNumber} ${prize.rewardCode} high weight`),
    prizeWeight: requireNumber(prizeWeights.get(prize.rewardCode), `stage ${stageNumber} ${prize.rewardCode} prize weight`),
    dailyLimitWeight: requireNumber(
      dailyLimitWeights.get(prize.rewardCode),
      `stage ${stageNumber} ${prize.rewardCode} dailyLimit weight`,
    ),
  }));
}

function parseThresholds(workbook: XLSX.WorkBook) {
  const thresholds = new Map<number, number>();
  let dailyPayoutLimitPoints = 0;

  for (const row of getSheetRows(workbook, '門檻設置')) {
    const dailyLimitIndex = row.findIndex((cell) => normalizeText(cell) === '每日送出上限');
    if (dailyLimitIndex >= 0) {
      dailyPayoutLimitPoints = readNextNumber(row, dailyLimitIndex + 1, 'daily payout limit');
      continue;
    }

    for (let index = 0; index < row.length; index += 1) {
      const stageNumber = parseStageNumber(row[index]);
      if (stageNumber) {
        thresholds.set(stageNumber, readNextNumber(row, index + 1, `stage ${stageNumber} threshold`));
      }
    }
  }

  assertCompleteStages(thresholds, 'threshold');
  return { thresholds, dailyPayoutLimitPoints };
}

function parsePrizeAmounts(workbook: XLSX.WorkBook, stageNumber: number) {
  const prizes: Array<Omit<PrizeConfig, 'lowWeight' | 'highWeight' | 'prizeWeight' | 'dailyLimitWeight'>> = [];

  for (const row of getSheetRows(workbook, `PrizeLV${stageNumber}`)) {
    const rewardIndex = row.findIndex((cell) => REWARD_CODES.includes(normalizeText(cell)));
    if (rewardIndex < 0) {
      continue;
    }

    const rewardCode = normalizeText(row[rewardIndex]);
    prizes.push({
      rewardCode,
      name: normalizeText(row[rewardIndex + 1]) || `${rewardCode} Prize`,
      amountPoints: readNextNumber(row, rewardIndex + 1, `stage ${stageNumber} ${rewardCode} amount`),
      sortOrder: REWARD_CODES.indexOf(rewardCode) + 1,
    });
  }

  assertCompleteRewards(new Map(prizes.map((prize) => [prize.rewardCode, prize.amountPoints])), `stage ${stageNumber} prize amounts`);
  return prizes.sort((a, b) => a.sortOrder - b.sortOrder);
}

function parsePrizeWeights(workbook: XLSX.WorkBook, stageNumber: number, tableName: string) {
  const weights = new Map<string, number>();

  for (const row of getSheetRows(workbook, `LV${stageNumber}`)) {
    const rewardIndex = row.findIndex((cell) => REWARD_CODES.includes(normalizeText(cell)));
    if (rewardIndex < 0) {
      continue;
    }

    const rewardCode = normalizeText(row[rewardIndex]);
    weights.set(rewardCode, readNextNumber(row, rewardIndex + 1, `stage ${stageNumber} ${rewardCode} ${tableName} weight`));
  }

  assertCompleteRewards(weights, `stage ${stageNumber} ${tableName} weights`);
  return weights;
}

function parseTableWeights(workbook: XLSX.WorkBook) {
  const splits = new Map<number, { low: number; high: number }>();
  let currentStage: number | undefined;

  for (const row of getSheetRows(workbook, 'Weight')) {
    const stageNumber = row.map(parseStageNumber).find(Boolean);
    if (stageNumber) {
      currentStage = stageNumber;
      if (!splits.has(stageNumber)) {
        splits.set(stageNumber, { low: 0, high: 0 });
      }
      continue;
    }

    if (!currentStage) {
      continue;
    }

    const tableIndex = row.findIndex((cell) => ['low', 'high'].includes(normalizeText(cell).toLowerCase()));
    if (tableIndex < 0) {
      continue;
    }

    const table = normalizeText(row[tableIndex]).toLowerCase() as 'low' | 'high';
    const split = splits.get(currentStage) ?? { low: 0, high: 0 };
    split[table] = readNextNumber(row, tableIndex + 1, `stage ${currentStage} ${table} split weight`);
    splits.set(currentStage, split);
  }

  for (const stageNumber of [1, 2, 3, 4, 5]) {
    const split = splits.get(stageNumber);
    if (!split || split.low + split.high <= 0) {
      throw new Error(`Missing low/high split weights for stage ${stageNumber}.`);
    }
  }

  return splits;
}

function getSheetRows(workbook: XLSX.WorkBook, sheetName: string): SheetRows {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Missing worksheet: ${sheetName}.`);
  }

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: null,
    raw: true,
  }) as SheetRows;
}

function readWorkbook(buffer: ArrayBuffer) {
  return XLSX.read(buffer, { type: 'array' });
}

function requireZipEntry(files: Map<string, JSZip.JSZipObject>, fileName: string) {
  const file = files.get(fileName);
  if (!file) {
    throw new Error(`Missing ${fileName} in uploaded probability zip.`);
  }

  return file;
}

function parseStageNumber(value: CellValue): number | undefined {
  const text = normalizeText(value);
  if (!text) {
    return undefined;
  }

  const lvMatch = text.match(/^(?:LV|Stage)\s*([1-5])$/i);
  if (lvMatch) {
    return Number(lvMatch[1]);
  }

  for (const [chineseNumber, stageNumber] of STAGE_TEXT_MAP.entries()) {
    if (text.includes(`第${chineseNumber}`)) {
      return stageNumber;
    }
  }

  return undefined;
}

function normalizeText(value: CellValue): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function readNextNumber(row: CellValue[], fromIndex: number, label: string): number {
  for (let index = fromIndex; index < row.length; index += 1) {
    const parsed = parseNumber(row[index]);
    if (parsed !== undefined) {
      return parsed;
    }
  }

  throw new Error(`Missing numeric value for ${label}.`);
}

function parseNumber(value: CellValue): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return assertInteger(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().replace(/,/g, '');
    if (trimmed !== '' && Number.isFinite(Number(trimmed))) {
      return assertInteger(Number(trimmed));
    }
  }

  return undefined;
}

function assertInteger(value: number): number {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer point value, received ${value}.`);
  }

  return value;
}

function requireNumber(value: number | undefined, label: string) {
  if (value === undefined) {
    throw new Error(`Missing numeric value for ${label}.`);
  }

  return value;
}

function assertCompleteStages(values: Map<number, unknown>, label: string) {
  for (const stageNumber of [1, 2, 3, 4, 5]) {
    if (!values.has(stageNumber)) {
      throw new Error(`Missing stage ${stageNumber} ${label}.`);
    }
  }
}

function assertCompleteRewards(values: Map<string, unknown>, label: string) {
  for (const rewardCode of REWARD_CODES) {
    if (!values.has(rewardCode)) {
      throw new Error(`Missing reward ${rewardCode} in ${label}.`);
    }
  }
}

function pushDiff(
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
    label:
      stageNumber === 0
        ? (DIFF_FIELD_LABELS[field] ?? field)
        : rewardCode
          ? `Stage ${stageNumber} / ${rewardCode} 獎 / ${DIFF_FIELD_LABELS[field] ?? field}`
          : `Stage ${stageNumber} / ${DIFF_FIELD_LABELS[field] ?? field}`,
    before,
    after,
  });
}
