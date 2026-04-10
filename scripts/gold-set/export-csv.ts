import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { stringify } from 'csv-stringify/sync';

interface ICandidate {
  rowNumber: number;
  deckHero: string;
  deckName: string;
  originalCard: string;
  originalCardName: string;
  proposedSubstitute: string;
  proposedSubstituteName: string;
  engineTier: number;
  engineScore: number;
  rationale: string;
}

const CANDIDATES_PATH = join(__dirname, 'out', 'candidates.json');
const CSV_PATH = join(__dirname, '..', '..', 'docs', 'brainstorms', 'gates', 'gate-4-gold-set.csv');
const HIDDEN_PATH = join(__dirname, 'out', 'gate-4-gold-set.hidden.json');

function main(): void {
  console.log('Reading candidates...');
  const candidates: ICandidate[] = JSON.parse(
    readFileSync(CANDIDATES_PATH, 'utf8'),
  );

  if (candidates.length === 0) {
    console.error('No candidates found. Run generate-candidates.ts first.');
    process.exit(1);
  }

  console.log(`Found ${candidates.length} candidates.`);

  // Blind CSV (no tier/score) for the labeler
  const csvRows = candidates.map((c) => ({
    rowNumber: c.rowNumber,
    deckHero: c.deckHero,
    deckName: c.deckName,
    originalCard: c.originalCardName,
    proposedSubstitute: c.proposedSubstituteName,
    label: '',
  }));

  const csv = stringify(csvRows, {
    header: true,
    columns: ['rowNumber', 'deckHero', 'deckName', 'originalCard', 'proposedSubstitute', 'label'],
  });

  mkdirSync(join(__dirname, '..', '..', 'docs', 'brainstorms', 'gates'), { recursive: true });
  writeFileSync(CSV_PATH, csv);
  console.log(`Wrote blind CSV to ${CSV_PATH}`);

  // Hidden JSON with full data keyed by rowNumber
  const hidden: Record<number, ICandidate> = {};
  for (const c of candidates) {
    hidden[c.rowNumber] = c;
  }
  writeFileSync(HIDDEN_PATH, JSON.stringify(hidden, null, 2));
  console.log(`Wrote hidden data to ${HIDDEN_PATH}`);

  console.log('\nNext steps:');
  console.log(`  1. Open ${CSV_PATH} in a spreadsheet`);
  console.log('  2. Fill the "label" column with: yes, no, or uncertain');
  console.log('  3. Save and run: pnpm tsx scripts/gold-set/score.ts');
}

main();
