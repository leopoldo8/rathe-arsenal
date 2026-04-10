import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

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

interface ICsvRow {
  rowNumber: string;
  deckHero: string;
  deckName: string;
  originalCard: string;
  proposedSubstitute: string;
  label: string;
}

const CSV_PATH = join(__dirname, '..', '..', 'docs', 'brainstorms', 'gates', 'gate-4-gold-set.csv');
const HIDDEN_PATH = join(__dirname, 'out', 'gate-4-gold-set.hidden.json');
const RESULT_PATH = join(__dirname, '..', '..', 'docs', 'brainstorms', 'gates', 'gate-4-score-result.md');

function main(): void {
  console.log('Reading labeled CSV...');
  const csvRaw = readFileSync(CSV_PATH, 'utf8');
  const rows: ICsvRow[] = parse(csvRaw, { columns: true, trim: true });

  console.log('Reading hidden data...');
  const hidden: Record<string, ICandidate> = JSON.parse(
    readFileSync(HIDDEN_PATH, 'utf8'),
  );

  const labeled = rows.filter((r) => r.label && r.label.trim().length > 0);
  if (labeled.length === 0) {
    console.error('No labeled rows found. Fill in the "label" column first.');
    process.exit(1);
  }

  let yesCount = 0;
  let noCount = 0;
  let uncertainCount = 0;
  const noRows: Array<{ row: ICsvRow; candidate: ICandidate | undefined }> = [];

  for (const row of labeled) {
    const label = row.label.trim().toLowerCase();
    if (label === 'yes') {
      yesCount++;
    } else if (label === 'no') {
      noCount++;
      noRows.push({ row, candidate: hidden[row.rowNumber] });
    } else if (label === 'uncertain') {
      uncertainCount++;
    } else {
      console.warn(`Unknown label "${row.label}" in row ${row.rowNumber}, treating as uncertain`);
      uncertainCount++;
    }
  }

  const denominator = yesCount + noCount;
  if (denominator === 0) {
    console.error('All rows are "uncertain". Cannot compute acceptance rate.');
    process.exit(1);
  }

  const acceptanceRate = (yesCount / denominator) * 100;

  let verdict: string;
  let interpretation: string;
  if (acceptanceRate >= 80) {
    verdict = 'PASS';
    interpretation = 'HIGH_CONFIDENCE';
  } else if (acceptanceRate >= 70) {
    verdict = 'PASS';
    interpretation = 'SOFT_CONFIDENCE';
  } else {
    verdict = 'FAIL';
    interpretation = 'BELOW_THRESHOLD';
  }

  console.log(`\n=== Gate 4 Score Result ===`);
  console.log(`Yes: ${yesCount}, No: ${noCount}, Uncertain: ${uncertainCount}`);
  console.log(`Acceptance rate: ${acceptanceRate.toFixed(1)}% (${yesCount}/${denominator})`);
  console.log(`Verdict: ${verdict} (${interpretation})`);

  // Write result markdown
  const md = `# Gate 4 Score Result

## Verdict: ${verdict} (${interpretation})

- **Acceptance rate**: ${acceptanceRate.toFixed(1)}% (${yesCount}/${denominator})
- **Yes**: ${yesCount}
- **No**: ${noCount}
- **Uncertain**: ${uncertainCount} (excluded from denominator)
- **Total labeled**: ${labeled.length}

## Thresholds

| Range | Verdict | Interpretation |
|-------|---------|----------------|
| >= 80% | PASS | HIGH_CONFIDENCE |
| 70-79% | PASS | SOFT_CONFIDENCE |
| < 70% | FAIL | BELOW_THRESHOLD |

## Rejected Substitutions (labeled "no")

${noRows.length === 0 ? 'None.' : ''}
${noRows
  .map((n) => {
    const c = n.candidate;
    return `### Row ${n.row.rowNumber}: ${n.row.originalCard} -> ${n.row.proposedSubstitute}
- **Deck**: ${n.row.deckName} (${n.row.deckHero})
- **Engine tier**: ${c?.engineTier ?? 'N/A'}
- **Engine score**: ${c?.engineScore?.toFixed(2) ?? 'N/A'}
- **Rationale**: ${c?.rationale ?? 'N/A'}
`;
  })
  .join('\n')}

## Next Steps

${verdict === 'FAIL' ? `- Inspect the "no" substitutions above for failure patterns
- Adjust engine weights in \`packages/engine/src/substitution/constants.ts\`
- Regenerate candidates from DIFFERENT decks and re-label
` : verdict === 'PASS' && interpretation === 'SOFT_CONFIDENCE' ? `- Cross-check with informal user feedback from the beta testers
- Consider tightening the engine before Phase 1
` : `- Engine quality is validated for Phase 0
- Proceed to Phase 1 planning
`}

---
Generated: ${new Date().toISOString()}
`;

  writeFileSync(RESULT_PATH, md);
  console.log(`\nWrote result to ${RESULT_PATH}`);
}

main();
