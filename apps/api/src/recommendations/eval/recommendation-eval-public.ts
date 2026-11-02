import { EnvDto } from '../../config/env.dto';
import { authorKeyOf, IPublicDeck, listPublicDecks, publicUsageSignal, toPublicDeck } from '../public-deck-usage';
import { IUsageSignal } from '../usage-signal';
import { fetchDeckRows, searchIndex } from './recommendation-eval-snapshot.cli';
import { IEvalScenario, IReferenceDeck, parseDeckCards, withExpectedFrom } from './recommendation-eval-scenarios';
import { IEvalSpec } from './recommendation-eval-specs';
import { authorFolds, publicHoldout } from './recommendation-eval-variant';

export interface IPublicEvalUsage {
  readonly usage: IUsageSignal | null;
  readonly note: string;
}

export interface IPublicFoldScenario extends IPublicEvalUsage {
  readonly scenario: IEvalScenario;
}

interface IPublicIndex {
  readonly hits: Awaited<ReturnType<typeof searchIndex>>;
  /** Author key of every deck the live index lists, by deck id. */
  readonly authorByDeck: ReadonlyMap<string, string>;
}

async function readPublicIndex(spec: IEvalSpec): Promise<IPublicIndex> {
  const hits = await searchIndex(spec, 'community');
  return { hits, authorByDeck: new Map(hits.map((hit) => [hit.deckId, authorKeyOf(hit.userId, hit.deckId)])) };
}

/**
 * The public deck signal production would send, read live from Fabrary through the production selection, with every
 * reference deck of the scenario and every deck of their authors held out (`publicHoldout`).
 */
export async function readHeldOutPublicUsage(spec: IEvalSpec, referenceDecks: readonly IReferenceDeck[], env: EnvDto, now: Date): Promise<IPublicEvalUsage> {
  const index = await readPublicIndex(spec);
  const holdout = publicHoldout(referenceDecks, index.authorByDeck);
  const excludedIds = new Set(holdout.excludeFabraryUlids);
  const excludedAuthors = new Set(holdout.excludeAuthorKeys);
  const open = index.hits.filter((hit) => !excludedIds.has(hit.deckId) && !excludedAuthors.has(index.authorByDeck.get(hit.deckId)!));
  const decks: IPublicDeck[] = [];
  for (const listing of listPublicDecks(open, { heroIdentifier: spec.heroIdentifier, format: spec.format, now })) {
    const rows = await fetchDeckRows(listing.fabraryUlid, env);
    if (rows) decks.push(toPublicDeck(listing, rows));
  }
  const usage = publicUsageSignal(decks, { now, ...holdout });
  const heldOut = `${index.hits.length - open.length} of ${index.hits.length} public decks held out (${referenceDecks.length} reference decks, ${holdout.excludeAuthorKeys.length} reference authors, ${holdout.unknownAuthors} with an author the index no longer shows)`;
  return {
    usage,
    note: usage ? `Usage: no tournament signal; ${usage.decks} public decks after ${heldOut}.` : `Usage: no tournament signal and too few public decks after ${heldOut}, none sent.`,
  };
}

function referenceAsPublicDeck(deck: IReferenceDeck, authorByDeck: ReadonlyMap<string, string>): IPublicDeck {
  const rows = [...parseDeckCards(deck.cards).entries()].map(([cardIdentifier, quantity]) => ({ cardIdentifier, quantity }));
  // A community reference is dated by its last edit (the snapshot CLI's `listedDeck`), which is what a public deck keeps.
  const listing = { fabraryUlid: deck.id, authorKey: authorByDeck.get(deck.id) ?? authorKeyOf(undefined, deck.id), updatedAt: new Date(`${deck.date}T00:00:00.000Z`) };
  return toPublicDeck(listing, rows);
}

/**
 * Diagnostic for a scenario whose every public deck is a reference deck (Kayo Living Legend): the reference decks are
 * split into two folds with no author in common; each fold scenario takes its signal from one fold, through the
 * production selection and minimum, and its expected cards from the other. No deck is on both sides.
 */
export async function publicFoldScenarios(spec: IEvalSpec, scenario: IEvalScenario, referenceDecks: readonly IReferenceDeck[], now: Date): Promise<IPublicFoldScenario[]> {
  const index = await readPublicIndex(spec);
  const folds = authorFolds(referenceDecks, index.authorByDeck);
  return folds.map((signalDecks, foldIndex) => {
    const expectedDecks = folds[1 - foldIndex]!;
    const usage = publicUsageSignal(
      signalDecks.map((deck) => referenceAsPublicDeck(deck, index.authorByDeck)),
      { now },
    );
    const id = `${scenario.id}:fold-${foldIndex + 1}`;
    const note = usage
      ? `Fold diagnostic: usage from ${usage.decks} public reference decks of ${signalDecks.length} in this fold, expected cards from the other ${expectedDecks.length}; no author on both sides.`
      : `Fold diagnostic: the ${signalDecks.length} decks of this fold are below the minimum, none sent.`;
    return { scenario: withExpectedFrom(scenario, id, expectedDecks), usage, note };
  });
}
