import { writeFileSync } from 'fs';
import { join } from 'path';
import { catalog } from '../../packages/engine/src';
import { outDir } from './lib/paths';
import { scoreAll } from './lib/score';

function main(): void {
  const out = outDir();
  const result = scoreAll(out, catalog);
  if (!result.ok) {
    console.error(`${result.invalid} top-10 card(s) are unjudged or have a verdict other than yes or no; no result written`);
    process.exit(1);
  }
  const path = join(out, 'result.md');
  writeFileSync(path, result.markdown);
  console.log(result.markdown);
  console.log(`wrote ${path}`);
}

main();
