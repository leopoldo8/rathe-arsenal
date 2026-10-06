import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import type { ICatalog } from '../../../packages/engine/src';
import { readDecks, readRuns } from './io';
import { CANDIDATE_ORDER, type TCandidateName } from './types';

export const SHEET_COLUMNS = ['deck', 'hero', 'card', 'pitch', 'rules', 'verdict'] as const;
const SHUFFLE_SEED = 20261004;

export interface ISheetRow {
  readonly deck: string;
  readonly hero: string;
  readonly card: string;
  readonly pitch: string;
  readonly rules: string;
  readonly verdict: string;
}

export interface IKeyEntry {
  readonly deck: string;
  readonly card: string;
  readonly runs: readonly { readonly candidate: TCandidateName; readonly rank: number }[];
}

export function sheetPath(out: string): string {
  return join(out, 'judging-sheet.csv');
}

export function keyPath(out: string): string {
  return join(out, 'judging-key.json');
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: readonly T[]): T[] {
  const random = mulberry32(SHUFFLE_SEED);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

const pairKey = (deck: string, card: string): string => `${deck}\u0000${card}`;

export function readSheet(out: string): ISheetRow[] {
  const path = sheetPath(out);
  if (!existsSync(path)) return [];
  return parse(readFileSync(path, 'utf8'), { columns: true, skip_empty_lines: true }) as ISheetRow[];
}

/** Every (deck, card) any candidate's ok run put in its top 10, with the candidates and ranks that produced it. */
function collectKey(out: string): Map<string, IKeyEntry> {
  const entries = new Map<string, { deck: string; card: string; runs: { candidate: TCandidateName; rank: number }[] }>();
  for (const candidate of CANDIDATE_ORDER) {
    for (const run of readRuns(out, candidate)) {
      if (run.status !== 'ok' || !run.top10) continue;
      run.top10.forEach((card, index) => {
        const key = pairKey(run.deck, card);
        const entry = entries.get(key) ?? { deck: run.deck, card, runs: [] };
        entry.runs.push({ candidate, rank: index + 1 });
        entries.set(key, entry);
      });
    }
  }
  return entries;
}

/**
 * One seeded shuffle over the full (deck, card) set, taken from a canonical
 * ordering first, so a row's position depends only on which pairs are on the
 * sheet and never on which run was added when.
 */
export function orderBySeededShuffle<T extends { readonly deck: string; readonly card: string }>(items: readonly T[]): T[] {
  const canonical = [...items].sort((a, b) => {
    const left = pairKey(a.deck, a.card);
    const right = pairKey(b.deck, b.card);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return seededShuffle(canonical);
}

/**
 * Every (deck, card) on the sheet or in a run is one row, ordered by the single
 * seeded shuffle; verdicts already filled are kept per pair.
 */
export function buildSheet(out: string, catalog: ICatalog): { rows: ISheetRow[]; key: IKeyEntry[] } {
  const entries = collectKey(out);
  const existing = new Map(readSheet(out).map((r) => [pairKey(r.deck, r.card), r]));
  const heroByDeck = new Map(readDecks(out).map((d) => [d.deck, catalog.getCard(d.hero).name]));

  const pairs = new Map<string, { deck: string; card: string }>();
  for (const e of entries.values()) pairs.set(pairKey(e.deck, e.card), { deck: e.deck, card: e.card });
  for (const r of existing.values()) pairs.set(pairKey(r.deck, r.card), { deck: r.deck, card: r.card });

  const rows = orderBySeededShuffle([...pairs.values()]).map((pair): ISheetRow => {
    const kept = existing.get(pairKey(pair.deck, pair.card));
    if (kept) return kept;
    const card = catalog.getCard(pair.card);
    return {
      deck: pair.deck,
      hero: heroByDeck.get(pair.deck) ?? '',
      card: pair.card,
      pitch: card.pitch === null ? '' : String(card.pitch),
      rules: card.functionalText ?? '',
      verdict: '',
    };
  });

  const key = rows
    .map((r) => entries.get(pairKey(r.deck, r.card)))
    .filter((e): e is NonNullable<typeof e> => e !== undefined);
  return { rows, key };
}

export function sheetToCsv(rows: readonly ISheetRow[]): string {
  return stringify([...rows], { header: true, columns: [...SHEET_COLUMNS] });
}
