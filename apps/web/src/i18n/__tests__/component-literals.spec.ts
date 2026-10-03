import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const LITERALS: ReadonlyArray<readonly [string, string]> = [
  ['components/csv-sources/CsvSourceRow.tsx', "'Untitled CSV'"],
  ['components/csv-sources/DeleteSourceModal.tsx', "'This CSV'"],
  ['components/deck-detail/HeroDropdown.tsx', '>young<'],
  ['lib/format-relative-time.ts', 'Sem dados de preço'],
  ['lib/format-relative-time.ts', 'Atualizado há'],
];

describe('user-facing literals stay out of component and lib sources', () => {
  it.each(LITERALS)('%s does not hardcode %s', (file, literal) => {
    expect(fs.readFileSync(path.join(SRC_ROOT, file), 'utf-8')).not.toContain(literal);
  });
});
