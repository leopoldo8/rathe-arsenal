import { join } from 'path';
import type { ICatalog } from '../../../packages/engine/src';
import { FORMAT_RULES } from '../../../packages/engine/src';
import type { IRawDeck } from '../../gold-set/fetch-deck';
import { writeJson } from './io';
import { REQUIRED_DECK_COUNT, type IDeckFile } from './types';

export type TDeckFetcher = (ulid: string) => Promise<IRawDeck>;

export interface ILoadDecksResult {
  readonly written: readonly string[];
  readonly errors: readonly string[];
}

export function extractUlid(url: string): string | null {
  const match = url.match(/fabrary\.net\/decks\/([A-Za-z0-9]+)/);
  return match?.[1] ? match[1].toUpperCase() : null;
}

function toDeckFile(url: string, ulid: string, raw: IRawDeck): IDeckFile {
  return {
    deck: ulid,
    url,
    name: raw.name,
    hero: raw.heroIdentifier,
    format: raw.format,
    mainboard: raw.deckCards
      .filter((c) => c.quantity > 0)
      .map((c) => ({ card: c.cardIdentifier, quantity: c.quantity })),
  };
}

function findUnknownIdentifiers(deck: IDeckFile, catalog: ICatalog): string[] {
  const identifiers = [deck.hero, ...deck.mainboard.map((e) => e.card)];
  return identifiers.filter((id) => !catalog.indices.byIdentifier.has(id));
}

/**
 * Loads every deck, writing one file per deck that loads cleanly. A deck that
 * fails writes nothing and adds an error naming its URL; the list itself is
 * checked first so a short list writes no file at all.
 */
export async function loadDecks(
  urls: readonly string[],
  fetcher: TDeckFetcher,
  catalog: ICatalog,
  out: string,
): Promise<ILoadDecksResult> {
  if (urls.length < REQUIRED_DECK_COUNT) {
    return {
      written: [],
      errors: [`${urls.length} deck URL(s) listed, but ${REQUIRED_DECK_COUNT} are required (three are required)`],
    };
  }

  const written: string[] = [];
  const errors: string[] = [];
  for (const url of urls) {
    const ulid = extractUlid(url);
    if (!ulid) {
      errors.push(`${url}: cannot extract a Fabrary deck id`);
      continue;
    }
    try {
      const deck = toDeckFile(url, ulid, await fetcher(ulid));
      const unknown = findUnknownIdentifiers(deck, catalog);
      if (unknown.length > 0) {
        errors.push(`${url}: card identifier(s) absent from the catalog: ${unknown.join(', ')}`);
        continue;
      }
      if (!(deck.format in FORMAT_RULES)) {
        errors.push(`${url}: format "${deck.format}" is not one of the four supported formats`);
        continue;
      }
      const path = join(out, 'decks', `${ulid}.json`);
      writeJson(path, deck);
      written.push(path);
    } catch (error) {
      errors.push(`${url}: could not be fetched (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return { written, errors };
}
