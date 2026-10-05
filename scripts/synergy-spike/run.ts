import { catalog } from '../../packages/engine/src';
import { readPool } from './lib/io';
import { dryRunLlm, missingKeyMessage, resolveLlmClient, type TFetch } from './lib/llm';
import { MODEL_CONFIGS, configFor } from './lib/models.config';
import { outDir } from './lib/paths';
import { runCandidate, selectDecks } from './lib/run-candidate';
import { CANDIDATE_ORDER, type TCandidateName } from './lib/types';

const LLM_ALL = 'llm-all';

interface IArgs {
  readonly candidates: readonly TCandidateName[];
  readonly deck?: string;
  readonly dryRun: boolean;
  readonly force: boolean;
}

function parseArgs(argv: readonly string[]): IArgs {
  const name = argv.find((a) => !a.startsWith('--'));
  const candidates = name === LLM_ALL
    ? MODEL_CONFIGS.map((c) => c.candidate)
    : CANDIDATE_ORDER.filter((c) => c === name);
  if (candidates.length === 0) {
    console.error(`usage: pnpm synergy:run <${[...CANDIDATE_ORDER, LLM_ALL].join('|')}> [--deck <ULID>] [--dry-run] [--force]`);
    process.exit(1);
  }
  const deckFlag = argv.indexOf('--deck');
  const flags = { dryRun: argv.includes('--dry-run'), force: argv.includes('--force') };
  return deckFlag >= 0 && argv[deckFlag + 1] !== undefined
    ? { candidates, deck: argv[deckFlag + 1] as string, ...flags }
    : { candidates, ...flags };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const out = outDir();
  const configs = args.candidates.flatMap((c) => configFor(c) ?? []);

  if (args.dryRun) {
    const decks = selectDecks(out, args.deck);
    for (const line of dryRunLlm(configs, decks, (id) => readPool(out, id), catalog)) console.log(line);
    process.exit(0);
  }

  const llm = configs.length > 0 ? resolveLlmClient(process.env, fetch as unknown as TFetch) : null;
  if (configs.length > 0 && llm === null) {
    console.error(missingKeyMessage());
    process.exit(1);
  }

  let exitCode = 0;
  for (const candidate of args.candidates) {
    const result = await runCandidate({ candidate, out, catalog, onlyDeck: args.deck, llm: llm ?? undefined, force: args.force });
    if (result.runs.length === 0) {
      console.error('no decks found: run `pnpm synergy:decks` and `pnpm synergy:pool` first');
      process.exit(1);
    }
    for (const run of result.runs) {
      const usage = run.usage ? ` [${run.usage.inputTokens} in, ${run.usage.outputTokens} out]` : '';
      const why = run.stopReason ?? run.error;
      console.log(`${run.deck} ${candidate}: ${run.status}${why ? ` (${why})` : ''}${usage}`);
    }
    exitCode = Math.max(exitCode, result.exitCode);
  }
  process.exit(exitCode);
}

void main();
