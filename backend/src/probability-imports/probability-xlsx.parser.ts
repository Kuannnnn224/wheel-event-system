import { existsSync } from 'fs';
import { join } from 'path';
import AdmZip = require('adm-zip');
import * as XLSX from 'xlsx';
import { ProbabilityConfigFile, ProbabilityPrizeConfig } from '../probability/probability-config.types';

type CellValue = string | number | boolean | Date | null | undefined;
type SheetRows = CellValue[][];

const REWARD_CODES = ['A', 'B', 'C', 'D', 'E'];
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

export function parseProbabilityXlsxDirectory(sourceDir: string): ProbabilityConfigFile {
  const resolvedSourceDir = resolveSourceDirectory(sourceDir);
  return parseProbabilityWorkbooks({
    configWorkbook: XLSX.readFile(requireSourceFile(resolvedSourceDir, 'config.xlsx')),
    lowWorkbook: XLSX.readFile(requireSourceFile(resolvedSourceDir, 'low.xlsx')),
    highWorkbook: XLSX.readFile(requireSourceFile(resolvedSourceDir, 'high.xlsx')),
    prizeWorkbook: XLSX.readFile(requireSourceFile(resolvedSourceDir, 'prize.xlsx')),
    dailyLimitWorkbook: XLSX.readFile(requireSourceFile(resolvedSourceDir, 'dailyLimit.xlsx')),
    weightWorkbook: XLSX.readFile(requireSourceFile(resolvedSourceDir, 'weight.xlsx')),
  });
}

export function parseProbabilityXlsxZip(zipBuffer: Buffer): ProbabilityConfigFile {
  const zip = new AdmZip(zipBuffer);
  const files = new Map<string, Buffer>();

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }

    const fileName = entry.entryName.split(/[\\/]/).pop()?.toLowerCase();
    if (fileName) {
      files.set(fileName, entry.getData());
    }
  }

  return parseProbabilityWorkbooks({
    configWorkbook: XLSX.read(requireZipEntry(files, 'config.xlsx'), { type: 'buffer' }),
    lowWorkbook: XLSX.read(requireZipEntry(files, 'low.xlsx'), { type: 'buffer' }),
    highWorkbook: XLSX.read(requireZipEntry(files, 'high.xlsx'), { type: 'buffer' }),
    prizeWorkbook: XLSX.read(requireZipEntry(files, 'prize.xlsx'), { type: 'buffer' }),
    dailyLimitWorkbook: XLSX.read(requireZipEntry(files, 'dailylimit.xlsx'), { type: 'buffer' }),
    weightWorkbook: XLSX.read(requireZipEntry(files, 'weight.xlsx'), { type: 'buffer' }),
  });
}

function parseProbabilityWorkbooks(workbooks: ProbabilitySourceWorkbooks): ProbabilityConfigFile {
  const { thresholds, dailyPayoutLimitPoints } = parseThresholds(workbooks.configWorkbook);
  const tableWeights = parseTableWeights(workbooks.weightWorkbook);

  return {
    version: 1,
    dailyPayoutLimitPoints,
    stages: [1, 2, 3, 4, 5].map((stageNumber) => {
      const prizes = parseStagePrizes(
        workbooks.configWorkbook,
        workbooks.lowWorkbook,
        workbooks.highWorkbook,
        workbooks.prizeWorkbook,
        workbooks.dailyLimitWorkbook,
        stageNumber,
      );
      const split = tableWeights.get(stageNumber);

      if (!split) {
        throw new Error(`Missing low/high split weights for stage ${stageNumber}.`);
      }

      return {
        stageNumber,
        turnoverThresholdPoints: requireNumber(thresholds.get(stageNumber), `stage ${stageNumber} threshold`),
        lowTableWeight: split.low,
        highTableWeight: split.high,
        prizes,
      };
    }),
  };
}

function requireZipEntry(files: Map<string, Buffer>, fileName: string) {
  const file = files.get(fileName);
  if (!file) {
    throw new Error(`Missing ${fileName} in uploaded probability zip.`);
  }

  return file;
}

function requireSourceFile(sourceDir: string, fileName: string) {
  const path = join(sourceDir, fileName);
  if (!existsSync(path)) {
    throw new Error(`Missing ${fileName} in probability source directory.`);
  }

  return path;
}

function resolveSourceDirectory(sourceDir: string) {
  if (existsSync(join(sourceDir, 'config.xlsx'))) {
    return sourceDir;
  }

  const nestedSourceDir = join(sourceDir, 'source');
  if (existsSync(join(nestedSourceDir, 'config.xlsx'))) {
    return nestedSourceDir;
  }

  throw new Error(`Cannot find config.xlsx under ${sourceDir}.`);
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

    for (let index = 0; index < row.length; index++) {
      const stageNumber = parseStageNumber(row[index]);
      if (!stageNumber) {
        continue;
      }

      thresholds.set(stageNumber, readNextNumber(row, index + 1, `stage ${stageNumber} threshold`));
    }
  }

  assertCompleteStages(thresholds, 'threshold');
  return { thresholds, dailyPayoutLimitPoints };
}

function parseStagePrizes(
  configWorkbook: XLSX.WorkBook,
  lowWorkbook: XLSX.WorkBook,
  highWorkbook: XLSX.WorkBook,
  prizeWorkbook: XLSX.WorkBook,
  dailyLimitWorkbook: XLSX.WorkBook,
  stageNumber: number,
): ProbabilityPrizeConfig[] {
  const lowWeights = parsePrizeWeights(lowWorkbook, stageNumber, 'low');
  const highWeights = parsePrizeWeights(highWorkbook, stageNumber, 'high');
  const prizeWeights = parsePrizeWeights(prizeWorkbook, stageNumber, 'prize');
  const dailyLimitWeights = parsePrizeWeights(dailyLimitWorkbook, stageNumber, 'dailyLimit');

  return parsePrizeAmounts(configWorkbook, stageNumber).map((prize) => ({
    ...prize,
    lowWeight: requireNumber(lowWeights.get(prize.rewardCode), `stage ${stageNumber} ${prize.rewardCode} low weight`),
    highWeight: requireNumber(highWeights.get(prize.rewardCode), `stage ${stageNumber} ${prize.rewardCode} high weight`),
    prizeWeight: requireNumber(prizeWeights.get(prize.rewardCode), `stage ${stageNumber} ${prize.rewardCode} prize weight`),
    dailyLimitWeight: requireNumber(dailyLimitWeights.get(prize.rewardCode), `stage ${stageNumber} ${prize.rewardCode} dailyLimit weight`),
  }));
}

function parsePrizeAmounts(workbook: XLSX.WorkBook, stageNumber: number) {
  const prizes: Array<Omit<ProbabilityPrizeConfig, 'lowWeight' | 'highWeight' | 'prizeWeight' | 'dailyLimitWeight'>> = [];
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
  for (let index = fromIndex; index < row.length; index++) {
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
