import { catalog } from '../../packages/engine/src';
import { readPool } from './lib/io';
import { createLlmClientFromEnv, dryRunLlm, missingKeyMessage } from './lib/llm';
import { createSdkClient } from './lib/llm-client';
import { outDir } from './lib/paths';
import { runCandidate, selectDecks } from './lib/run-candidate';
import { CANDIDATE_ORDER, type TCandidateName } from './lib/types';

interface IArgs {
  readonly candidate: TCandidateName;
  readonly deck?: string;
  readonly dryRun: boolean;
  readonly force: boolean;
}

function parseArgs(argv: readonly string[]): IArgs {
  const candidate = argv.find((a) => !a.startsWith('--')) as TCandidateName | undefined;
  if (!candidate || !CANDIDATE_ORDER.includes(candidate)) {
    console.error(`usage: pnpm synergy:run <${CANDIDATE_ORDER.join('|')}> [--deck <ULID>] [--dry-run] [--force]`);
    process.exit(1);
  }
  const deckFlag = argv.indexOf('--deck');
  const flags = { dryRun: argv.includes('--dry-run'), force: argv.includes('--force') };
  return deckFlag >= 0 && argv[deckFlag + 1] !== undefined
    ? { candidate, deck: argv[deckFlag + 1] as string, ...flags }
    : { candidate, ...flags };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const out = outDir();

  const llm = args.candidate === 'llm' ? createLlmClientFromEnv(process.env, createSdkClient) : undefined;
  if (args.candidate === 'llm' && llm === null) {
    console.error(missingKeyMessage());
    process.exit(1);
  }

  if (args.dryRun && llm) {
    const decks = selectDecks(out, args.deck);
    for (const line of await dryRunLlm(decks, (id) => readPool(out, id), catalog, llm)) console.log(line);
    process.exit(0);
  }

  const { runs, exitCode } = await runCandidate({
    candidate: args.candidate,
    out,
    catalog,
    onlyDeck: args.deck,
    llm: llm ?? undefined,
    force: args.force,
  });
  if (runs.length === 0) {
    console.error('no decks found: run `pnpm synergy:decks` and `pnpm synergy:pool` first');
    process.exit(1);
  }
  for (const run of runs) {
    const usage = run.usage ? ` [${run.usage.inputTokens} in, ${run.usage.outputTokens} out]` : '';
    const why = run.stopReason ?? run.error;
    console.log(`${run.deck} ${args.candidate}: ${run.status}${why ? ` (${why})` : ''}${usage}`);
  }
  process.exit(exitCode);
}

void main();
