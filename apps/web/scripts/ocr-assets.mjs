import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);

export function ocrAssetSources() {
  const tesseractRoot = path.dirname(require.resolve('tesseract.js/package.json'));
  const coreRoot = path.dirname(
    require.resolve('tesseract.js-core/package.json', { paths: [tesseractRoot] }),
  );
  const languageData = require.resolve('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz');
  const coreFiles = fs
    .readdirSync(coreRoot)
    .filter((name) => name.startsWith('tesseract-core'))
    .map((name) => path.join(coreRoot, name));
  return [path.join(tesseractRoot, 'dist/worker.min.js'), languageData, ...coreFiles];
}
