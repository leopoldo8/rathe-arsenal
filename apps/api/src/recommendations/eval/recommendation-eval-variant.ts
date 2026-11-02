import { ICatalog, ICatalogCard } from '@rathe-arsenal/engine';
import { buildRecommendationPool } from '../recommendation-prompt';
import { IUsageSignal } from '../usage-signal';
import { IEvalScenario, IReferenceDeck } from './recommendation-eval-scenarios';
import { IEvalSpec } from './recommendation-eval-specs';

/** Which production options a run turns on; the baseline turns none on and sends main's prompt byte for byte. */
export interface IEvalVariant {
  readonly dropPitchSiblings: boolean;
  readonly usage: IUsageSignal | null;
}

export interface IEvalHoldout {
  readonly excludeFabraryUlids: readonly string[];
  readonly createdBefore: Date | undefined;
}

/**
 * The usage signal must not see the decks the expected cards come from, or the eval would pass by construction.
 * Every reference deck is left out by id. Tournament references share the tournament table with the signal, so every
 * deck created on or after the oldest reference deck is left out too: the signal only knows the past. Community
 * references are never in that table, so their ids are enough.
 */
export function usageHoldout(spec: IEvalSpec, referenceDecks: readonly IReferenceDeck[]): IEvalHoldout {
  const oldest = [...referenceDecks].map((deck) => deck.date).sort()[0];
  return {
    excludeFabraryUlids: referenceDecks.map((deck) => deck.id),
    createdBefore: spec.reference.source === 'tournament' && oldest ? new Date(`${oldest}T00:00:00.000Z`) : undefined,
  };
}

export interface IPublicHoldout {
  readonly excludeFabraryUlids: readonly string[];
  readonly excludeAuthorKeys: readonly string[];
  /** Reference decks whose author the live index no longer shows; only their id is held out. */
  readonly unknownAuthors: number;
}

/**
 * Public decks share Fabrary's index with community references, so every reference deck is left out by id, and every
 * deck of a reference author too: the same player's other list would carry the same choices into the signal.
 * `authorByDeck` maps a reference deck id to its author key (`authorKeyOf`), read from the live index.
 */
export function publicHoldout(referenceDecks: readonly IReferenceDeck[], authorByDeck: ReadonlyMap<string, string>): IPublicHoldout {
  const authors = referenceDecks.flatMap((deck) => {
    const author = authorByDeck.get(deck.id);
    return author === undefined ? [] : [author];
  });
  return {
    excludeFabraryUlids: referenceDecks.map((deck) => deck.id),
    excludeAuthorKeys: [...new Set(authors)],
    unknownAuthors: referenceDecks.length - authors.length,
  };
}

/**
 * Two folds of the reference decks that share no author: authors in order of their first deck id, alternately to the
 * first and the second fold. A deck with no known author is its own author.
 */
export function authorFolds(
  referenceDecks: readonly IReferenceDeck[],
  authorByDeck: ReadonlyMap<string, string>,
): readonly [IReferenceDeck[], IReferenceDeck[]] {
  const byAuthor = new Map<string, IReferenceDeck[]>();
  for (const deck of [...referenceDecks].sort((a, b) => a.id.localeCompare(b.id))) {
    const author = authorByDeck.get(deck.id) ?? `deck:${deck.id}`;
    byAuthor.set(author, [...(byAuthor.get(author) ?? []), deck]);
  }
  const groups = [...byAuthor.values()];
  return [groups.filter((_, index) => index % 2 === 0).flat(), groups.filter((_, index) => index % 2 === 1).flat()];
}

/** The pool and usage a run sends. Expected cards come from the baseline pool, so every variant scores the same cards. */
export function applyEvalVariant(
  scenario: IEvalScenario,
  variant: IEvalVariant,
  catalog: ICatalog,
): { readonly pool: readonly ICatalogCard[]; readonly usage: IUsageSignal | null } {
  if (!variant.dropPitchSiblings) return { pool: scenario.pool, usage: variant.usage };
  const pool = buildRecommendationPool(scenario.deck, scenario.heroCard, new Set(), catalog, {
    dropPitchSiblings: true,
    usage: variant.usage,
  });
  const ids = new Set(pool.map((card) => card.cardIdentifier));
  const lost = scenario.expected.filter((card) => !ids.has(card.cardIdentifier)).map((card) => card.cardIdentifier);
  if (lost.length > 0) throw new Error(`${scenario.id}: the variant pool drops expected cards ${lost.join(', ')}`);
  return { pool, usage: variant.usage };
}
