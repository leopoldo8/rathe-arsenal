import { writeFileSync } from 'fs';
import { catalog } from '../../packages/engine/src';
import { outDir } from './lib/paths';
import { writeJson } from './lib/io';
import { buildSheet, keyPath, sheetPath, sheetToCsv } from './lib/sheet';

function main(): void {
  const out = outDir();
  const { rows, key } = buildSheet(out, catalog);
  if (rows.length === 0) {
    console.error('no run with a top 10 found: run `pnpm synergy:run <candidate>` first');
    process.exit(1);
  }
  writeFileSync(sheetPath(out), sheetToCsv(rows));
  writeJson(keyPath(out), key);
  const judged = rows.filter((r) => r.verdict.trim() !== '').length;
  console.log(`${sheetPath(out)}: ${rows.length} rows (${judged} already judged)`);
  console.log('Fill the verdict column with yes or no. Keep judging-key.json out of sight until scoring.');
}

main();
