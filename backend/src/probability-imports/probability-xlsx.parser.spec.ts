import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import AdmZip = require('adm-zip');
import * as XLSX from 'xlsx';
import { parseProbabilityXlsxDirectory, parseProbabilityXlsxZip } from './probability-xlsx.parser';

function writeWorkbook(path: string, sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }
  writeFileSync(path, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

describe('parseProbabilityXlsxDirectory', () => {
  it('converts PM xlsx layout into runtime probability config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'probability-xlsx-'));
    const rewardRows = [
      [],
      [],
      [null, null, null, '獎勵等級', '品項', '數值'],
      [null, null, null, 'A', 'A prize', 1],
      [null, null, null, 'B', 'B prize', 2],
      [null, null, null, 'C', 'C prize', 3],
      [null, null, null, 'D', 'D prize', 4],
      [null, null, null, 'E', 'E prize', 5],
    ];

    writeWorkbook(join(dir, 'config.xlsx'), {
      門檻設置: [
        [],
        [],
        [null, null, null, '轉盤等級', '門檻設置'],
        [null, null, null, '第一階', 500],
        [null, null, null, '第二階', 5000],
        [null, null, null, '第三階', 20000],
        [null, null, null, '第四階', 50000],
        [null, null, null, '第五階', 100000],
      ],
      PrizeLV1: rewardRows,
      PrizeLV2: rewardRows,
      PrizeLV3: rewardRows,
      PrizeLV4: rewardRows,
      PrizeLV5: rewardRows,
    });

    writeWorkbook(join(dir, 'low.xlsx'), {
      LV1: [[null, null, null, '品項', '權重'], [null, null, null, 'A', 64], [null, null, null, 'B', 30], [null, null, null, 'C', 5], [null, null, null, 'D', 1], [null, null, null, 'E', 0]],
      LV2: [[null, null, null, 'A', 64], [null, null, null, 'B', 30], [null, null, null, 'C', 5], [null, null, null, 'D', 1], [null, null, null, 'E', 0]],
      LV3: [[null, null, null, 'A', 64], [null, null, null, 'B', 30], [null, null, null, 'C', 5], [null, null, null, 'D', 1], [null, null, null, 'E', 0]],
      LV4: [[null, null, null, 'A', 64], [null, null, null, 'B', 30], [null, null, null, 'C', 5], [null, null, null, 'D', 1], [null, null, null, 'E', 0]],
      LV5: [[null, null, null, 'A', 64], [null, null, null, 'B', 30], [null, null, null, 'C', 5], [null, null, null, 'D', 1], [null, null, null, 'E', 0]],
    });

    writeWorkbook(join(dir, 'high.xlsx'), {
      LV1: [[null, null, null, 'A', 41], [null, null, null, 'B', 50], [null, null, null, 'C', 7], [null, null, null, 'D', 2], [null, null, null, 'E', 0]],
      LV2: [[null, null, null, 'A', 40], [null, null, null, 'B', 50], [null, null, null, 'C', 7], [null, null, null, 'D', 3], [null, null, null, 'E', 0]],
      LV3: [[null, null, null, 'A', 40], [null, null, null, 'B', 50], [null, null, null, 'C', 7], [null, null, null, 'D', 3], [null, null, null, 'E', 0]],
      LV4: [[null, null, null, 'A', 40], [null, null, null, 'B', 50], [null, null, null, 'C', 7], [null, null, null, 'D', 3], [null, null, null, 'E', 0]],
      LV5: [[null, null, null, 'A', 40], [null, null, null, 'B', 50], [null, null, null, 'C', 7], [null, null, null, 'D', 3], [null, null, null, 'E', 0]],
    });

    writeWorkbook(join(dir, 'weight.xlsx'), {
      Weight: [
        [null, null, null, null, null, '第一組轉盤'],
        [null, null, null, null, null, 'low', 960],
        [null, null, null, null, null, 'high', 40],
        [null, null, null, null, null, '第二組轉盤'],
        [null, null, null, null, null, 'low', 950],
        [null, null, null, null, null, 'high', 50],
        [null, null, null, null, null, '第三組轉盤'],
        [null, null, null, null, null, 'low', 940],
        [null, null, null, null, null, 'high', 60],
        [null, null, null, null, null, '第四組轉盤'],
        [null, null, null, null, null, 'low', 930],
        [null, null, null, null, null, 'high', 70],
        [null, null, null, null, null, '第五組轉盤'],
        [null, null, null, null, null, 'low', 920],
        [null, null, null, null, null, 'high', 80],
      ],
    });

    const config = parseProbabilityXlsxDirectory(dir);

    expect(config.stages).toHaveLength(5);
    expect(config.stages[0].turnoverThresholdPoints).toBe(500);
    expect(config.stages[0].lowTableWeight).toBe(960);
    expect(config.stages[0].highTableWeight).toBe(40);
    expect(config.stages[0].prizes[0]).toMatchObject({
      rewardCode: 'A',
      name: 'A prize',
      amountPoints: 1,
      lowWeight: 64,
      highWeight: 41,
      sortOrder: 1,
    });
    expect(config.stages[0]).not.toHaveProperty('enabled');
    expect(config.stages[0].prizes[0]).not.toHaveProperty('enabled');
    expect(config.stages[4].lowTableWeight).toBe(920);
    expect(config.stages[4].highTableWeight).toBe(80);

    const zip = new AdmZip();
    zip.addLocalFolder(dir, 'source');
    const zipConfig = parseProbabilityXlsxZip(zip.toBuffer());

    expect(zipConfig).toEqual(config);
  });
});
