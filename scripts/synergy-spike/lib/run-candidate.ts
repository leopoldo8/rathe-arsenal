import type { ICatalog } from '../../../packages/engine/src';
import { rankHeuristic } from '../candidates/heuristic';
import { runCooccurrence } from '../candidates/cooccurrence';
import { existsSync } from 'fs';
import { readDecks, readJson, readPool, runPath, writeJson } from './io';
import { exitCodeFor, toRunFile } from './run-file';
import { runLlmDeck, type ILlmClient } from './llm';
import { configFor } from './models.config';
import type { IDeckFile, IRunFile, TCandidateName } from './types';

export interface IRunOptions {
  readonly candidate: TCandidateName;
  readonly out: string;
  readonly catalog: ICatalog;
  readonly onlyDeck?: string | undefined;
  readonly llm?: ILlmClient | undefined;
  /** Re-run decks whose language-model run already succeeded; off by default because each llm run costs money. */
  readonly force?: boolean | undefined;
}

export { toRunFile, exitCodeFor } from './run-file';

export function selectDecks(out: string, onlyDeck?: string): IDeckFile[] {
  const decks = readDecks(out);
  return onlyDeck === undefined ? decks : decks.filter((d) => d.deck === onlyDeck.toUpperCase());
}

function readExistingOk(out: string, candidate: TCandidateName, deck: string): IRunFile | null {
  const path = runPath(out, candidate, deck);
  if (!existsSync(path)) return null;
  const run = readJson<IRunFile>(path);
  return run.status === 'ok' ? run : null;
}

async function runDeck(deck: IDeckFile, opts: IRunOptions): Promise<IRunFile> {
  if (opts.candidate === 'cooccurrence') return runCooccurrence(deck.deck, deck.hero);
  const pool = readPool(opts.out, deck.deck);
  if (opts.candidate === 'heuristic') {
    return toRunFile(deck, pool, 'heuristic', rankHeuristic(deck, pool, opts.catalog));
  }
  const config = configFor(opts.candidate);
  if (!config || !opts.llm) throw new Error(`candidate "${opts.candidate}" needs a language-model client`);
  try {
    return await runLlmDeck(config, deck, pool, opts.catalog, opts.llm);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { deck: deck.deck, candidate: opts.candidate, status: 'failed', error: message };
  }
}

export async function runCandidate(opts: IRunOptions): Promise<{ runs: IRunFile[]; exitCode: number }> {
  const runs: IRunFile[] = [];
  for (const deck of selectDecks(opts.out, opts.onlyDeck)) {
    const existing = configFor(opts.candidate) && !opts.force ? readExistingOk(opts.out, opts.candidate, deck.deck) : null;
    if (existing) {
      runs.push(existing);
      continue;
    }
    const run = await runDeck(deck, opts);
    writeJson(runPath(opts.out, opts.candidate, deck.deck), run);
    runs.push(run);
  }
  return { runs, exitCode: exitCodeFor(runs) };
}
