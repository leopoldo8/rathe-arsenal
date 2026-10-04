import { catalog } from '../../packages/engine/src';
import { outDir } from './lib/paths';
import { runCandidate } from './lib/run-candidate';
import { CANDIDATE_ORDER, type TCandidateName } from './lib/types';

function parseArgs(argv: readonly string[]): { candidate: TCandidateName; deck?: string } {
  const candidate = argv.find((a) => !a.startsWith('--')) as TCandidateName | undefined;
  if (!candidate || !CANDIDATE_ORDER.includes(candidate)) {
    console.error(`usage: pnpm synergy:run <${CANDIDATE_ORDER.join('|')}> [--deck <ULID>]`);
    process.exit(1);
  }
  const deckFlag = argv.indexOf('--deck');
  const deck = deckFlag >= 0 ? argv[deckFlag + 1] : undefined;
  return deck === undefined ? { candidate } : { candidate, deck };
}

async function main(): Promise<void> {
  const { candidate, deck } = parseArgs(process.argv.slice(2));
  const { runs, exitCode } = await runCandidate({ candidate, out: outDir(), catalog, onlyDeck: deck });
  if (runs.length === 0) {
    console.error('no decks found: run `pnpm synergy:decks` and `pnpm synergy:pool` first');
    process.exit(1);
  }
  for (const run of runs) {
    console.log(`${run.deck} ${candidate}: ${run.status}${run.error ? ` (${run.error})` : ''}`);
  }
  process.exit(exitCode);
}

void main();
