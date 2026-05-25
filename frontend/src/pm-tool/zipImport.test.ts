import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildConfigDiff, parseProbabilityZipBuffer } from './zipImport';

function workbookBuffer(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

function rewardRows(amountBase: number) {
  return [
    [null, null, null, '獎勵等級', '品項', '數值'],
    [null, null, null, 'A', 'A prize', amountBase + 1],
    [null, null, null, 'B', 'B prize', amountBase + 2],
    [null, null, null, 'C', 'C prize', amountBase + 3],
    [null, null, null, 'D', 'D prize', amountBase + 4],
    [null, null, null, 'E', 'E prize', amountBase + 5],
  ];
}

function weightWorkbookRows() {
  return [
    [null, null, null, '第一組轉盤'],
    [null, null, null, 'low', 960],
    [null, null, null, 'high', 40],
    [null, null, null, '第二組轉盤'],
    [null, null, null, 'low', 950],
    [null, null, null, 'high', 50],
    [null, null, null, '第三組轉盤'],
    [null, null, null, 'low', 940],
    [null, null, null, 'high', 60],
    [null, null, null, '第四組轉盤'],
    [null, null, null, 'low', 930],
    [null, null, null, 'high', 70],
    [null, null, null, '第五組轉盤'],
    [null, null, null, 'low', 920],
    [null, null, null, 'high', 80],
  ];
}

function tableSheets(aWeight: number, bWeight: number) {
  return Object.fromEntries(
    [1, 2, 3, 4, 5].map((stageNumber) => [
      `LV${stageNumber}`,
      [
        [null, null, null, 'A', aWeight + stageNumber],
        [null, null, null, 'B', bWeight],
        [null, null, null, 'C', 3],
        [null, null, null, 'D', 2],
        [null, null, null, 'E', 1],
      ],
    ]),
  );
}

async function createProbabilityZip() {
  const zip = new JSZip();

  zip.file(
    'source/config.xlsx',
    workbookBuffer({
      門檻設置: [
        [null, null, null, '第一階', 500],
        [null, null, null, '第二階', 5000],
        [null, null, null, '第三階', 20000],
        [null, null, null, '第四階', 50000],
        [null, null, null, '第五階', 100000],
        ['每日送出上限', 123456],
      ],
      PrizeLV1: rewardRows(0),
      PrizeLV2: rewardRows(10),
      PrizeLV3: rewardRows(20),
      PrizeLV4: rewardRows(30),
      PrizeLV5: rewardRows(40),
    }),
  );
  zip.file('source/low.xlsx', workbookBuffer(tableSheets(60, 30)));
  zip.file('source/high.xlsx', workbookBuffer(tableSheets(40, 50)));
  zip.file('source/prize.xlsx', workbookBuffer(tableSheets(10, 20)));
  zip.file('source/daily-limit.xlsx', workbookBuffer(tableSheets(90, 8)));
  zip.file('source/weight.xlsx', workbookBuffer({ Weight: weightWorkbookRows() }));

  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('pm zip import', () => {
  it('parses the backend probability zip layout in the browser parser', async () => {
    const config = await parseProbabilityZipBuffer(await createProbabilityZip());

    expect(config.dailyPayoutLimitPoints).toBe(123456);
    expect(config.stages).toHaveLength(5);
    expect(config.stages[0]).toMatchObject({
      stageNumber: 1,
      turnoverThresholdPoints: 500,
      lowTableWeight: 960,
      highTableWeight: 40,
    });
    expect(config.stages[0].prizes[0]).toMatchObject({
      rewardCode: 'A',
      name: 'A prize',
      amountPoints: 1,
      lowWeight: 61,
      highWeight: 41,
      prizeWeight: 11,
      dailyLimitWeight: 91,
      sortOrder: 1,
    });
  });

  it('builds import diffs against current config', async () => {
    const proposedConfig = await parseProbabilityZipBuffer(await createProbabilityZip());
    const currentConfig = {
      ...proposedConfig,
      dailyPayoutLimitPoints: 0,
      stages: proposedConfig.stages.map((stage) =>
        stage.stageNumber === 1
          ? {
              ...stage,
              lowTableWeight: 1,
              prizes: stage.prizes.map((prize) => (prize.rewardCode === 'A' ? { ...prize, amountPoints: 999 } : prize)),
            }
          : stage,
      ),
    };

    expect(buildConfigDiff(currentConfig, proposedConfig).map((item) => item.label)).toContain('每日送出上限');
    expect(buildConfigDiff(currentConfig, proposedConfig).map((item) => item.label)).toContain('Stage 1 / Low 表分流權重');
    expect(buildConfigDiff(currentConfig, proposedConfig).map((item) => item.label)).toContain('Stage 1 / A 獎 / 獎勵點數');
  });
});
