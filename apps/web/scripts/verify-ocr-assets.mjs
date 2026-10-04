import path from 'node:path';
import fs from 'node:fs';
import { ocrAssetSources } from './ocr-assets.mjs';

const directory = process.argv[2];
if (!directory) {
  console.error('usage: node verify-ocr-assets.mjs <directory>');
  process.exit(2);
}
const missing = ocrAssetSources()
  .map((source) => path.basename(source))
  .filter((name) => !fs.existsSync(path.join(directory, name)));
if (missing.length > 0) {
  console.error(`missing OCR assets in ${directory}: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`all OCR assets present in ${directory}`);
