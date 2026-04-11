/**
 * Gate 4 gold-set regression.
 *
 * Guards the tier 1 acceptance floor that Gate 4 validated (73.7% over
 * 19 non-uncertain labeled pairs, SOFT_CONFIDENCE). Any engine commit
 * that degrades a previously-approved tier 1 match to tier 2 or to
 * null drops the regression acceptance rate and fails the suite,
 * blocking the commit in CI.
 *
 * This is the "must stay at least as good as Phase 0" gate — it does
 * not measure tier 2 quality. Tier 2 is validated separately against
 * a fresh labeling round during Phase 1a review.
 *
 * Sources:
 *  - docs/brainstorms/gates/gate-4-gold-set.csv  (human labels)
 *  - scripts/gold-set/out/gate-4-gold-set.hidden.json  (card identifiers)
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { catalog } from '../src/catalog/catalog';
import { findTierMatch } from '../src/substitution/score';
import { TIER_1_CONFIG } from '../src/substitution/constants';

interface IHiddenRow {
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

interface ICsvRow {
  rowNumber: number;
  originalName: string;
  proposedName: string;
  label: 'yes' | 'no' | 'uncertain';
}

const HIDDEN_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'gold-set',
  'out',
  'gate-4-gold-set.hidden.json',
);
const CSV_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'docs',
  'brainstorms',
  'gates',
  'gate-4-gold-set.csv',
);

/** Parse one CSV row, respecting double-quoted fields with commas. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function loadCsv(): ICsvRow[] {
  const raw = readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const [, ...rest] = lines; // skip header

  return rest.map((line) => {
    const cols = parseCsvLine(line);
    return {
      rowNumber: Number(cols[0]),
      originalName: cols[3] ?? '',
      proposedName: cols[4] ?? '',
      label: (cols[5] ?? '').trim().toLowerCase() as ICsvRow['label'],
    };
  });
}

function loadHidden(): Record<string, IHiddenRow> {
  return JSON.parse(readFileSync(HIDDEN_PATH, 'utf8'));
}

describe('Gate 4 gold-set regression (Phase 0 SOFT_CONFIDENCE floor)', () => {
  const csv = loadCsv();
  const hidden = loadHidden();
  const yesRows = csv.filter((r) => r.label === 'yes');

  it('has the expected number of labeled rows baked into the CSV', () => {
    // If this assertion fails, someone changed the gold set. Update the
    // acceptance bar explicitly -- do not silently adjust the counts.
    expect(csv.length).toBe(21);
    expect(yesRows.length).toBe(14);
    expect(csv.filter((r) => r.label === 'no').length).toBe(5);
    expect(csv.filter((r) => r.label === 'uncertain').length).toBe(2);
  });

  describe('each approved tier 1 pair still scores as tier 1', () => {
    // Generate a sub-test per row so failures point at the specific pair
    // that regressed rather than a single aggregate count.
    for (const row of csv.filter((r) => r.label === 'yes')) {
      it(`row ${row.rowNumber}: ${row.originalName} → ${row.proposedName}`, () => {
        const entry = hidden[String(row.rowNumber)];
        expect(entry).toBeDefined();
        expect(entry!.engineTier).toBe(1);

        const missingCard = catalog.indices.byIdentifier.get(entry!.originalCard);
        expect(missingCard).toBeDefined();

        // Inventory contains only the approved substitute so the engine
        // must either pick it at tier 1 or refuse. Any other outcome is
        // a regression on a human-approved tier 1 pair.
        const inventory = new Map<string, number>([
          [entry!.proposedSubstitute, 3],
        ]);

        const match = findTierMatch(
          missingCard!,
          inventory,
          catalog,
          TIER_1_CONFIG,
        );

        expect(match).not.toBeNull();
        expect(match!.tier).toBe(1);
        expect(match!.substitute.cardIdentifier).toBe(entry!.proposedSubstitute);
      });
    }
  });

  it('tier 1 acceptance rate on labeled rows stays at or above the 73.7% SOFT_CONFIDENCE bar', () => {
    // Aggregate gate: count how many of the 19 non-uncertain labeled
    // pairs the new engine still accepts at tier 1. A drop below 14/19
    // (73.7%) breaks the Gate 4 contract.
    const labeled = csv.filter((r) => r.label === 'yes' || r.label === 'no');
    let tier1Yes = 0;

    for (const row of labeled) {
      if (row.label !== 'yes') continue;
      const entry = hidden[String(row.rowNumber)];
      if (!entry) continue;

      const missingCard = catalog.indices.byIdentifier.get(entry.originalCard);
      if (!missingCard) continue;

      const inventory = new Map<string, number>([
        [entry.proposedSubstitute, 3],
      ]);
      const match = findTierMatch(missingCard, inventory, catalog, TIER_1_CONFIG);
      if (match !== null && match.tier === 1) tier1Yes += 1;
    }

    const acceptanceRate = (tier1Yes / labeled.length) * 100;
    // eslint-disable-next-line no-console
    console.log(
      `[gold-set] tier 1 acceptance: ${tier1Yes}/${labeled.length} (${acceptanceRate.toFixed(2)}%)`,
    );

    // Phase 0 Gate 4 landed at exactly 14/19 tier 1 yes-matches over the
    // non-uncertain labeled rows. That fraction is the SOFT_CONFIDENCE
    // floor the engine must not regress below. Comparing the raw count
    // keeps the gate robust against floating-point rounding on the 73.7%
    // display value.
    expect(tier1Yes).toBeGreaterThanOrEqual(14);
  });
});
