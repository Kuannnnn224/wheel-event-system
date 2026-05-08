import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { parseProbabilityXlsxDirectory } from '../src/probability/probability-xlsx.parser';

const sourceDirArg = process.argv[2];
const outputArg = process.argv[3] ?? 'config/probability.json';

if (!sourceDirArg) {
  console.error('Usage: npm run probability:import -- <xlsx-source-dir> [output-json]');
  process.exit(1);
}

const sourceDir = resolve(process.cwd(), sourceDirArg);
const outputPath = resolve(process.cwd(), outputArg);
const config = parseProbabilityXlsxDirectory(sourceDir);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');

console.log(`Imported ${config.stages.length} stages from ${sourceDir}`);
console.log(`Wrote ${outputPath}`);
for (const stage of config.stages) {
  console.log(
    `Stage ${stage.stageNumber}: threshold=${stage.turnoverThresholdPoints}, low=${stage.lowTableWeight}, high=${stage.highTableWeight}`,
  );
}
