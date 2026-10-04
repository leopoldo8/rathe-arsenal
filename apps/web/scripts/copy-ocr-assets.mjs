import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ocrAssetSources } from './ocr-assets.mjs';

const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/ocr');
fs.mkdirSync(target, { recursive: true });
for (const source of ocrAssetSources()) {
  fs.copyFileSync(source, path.join(target, path.basename(source)));
}
