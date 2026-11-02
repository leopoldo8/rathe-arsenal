import { ICatalog, ICatalogCard, Type } from '@rathe-arsenal/engine';
import { buildRecommendationPool, IDeckList, IDeckListCard } from '../recommendation-prompt';
import { IEvalSpec } from './recommendation-eval-specs';

/** A card counts as a staple when at least this share of the reference decks plays it. */
export const STAPLE_INCLUSION = 0.8;
/** Below this many reference decks an inclusion rate is too noisy to expect anything from the model. */
export const MIN_REFERENCE_DECKS = 8;

/** One public deck, stored compactly: `cards` is `identifier:quantity` pairs separated by spaces, inventory left out. */
export interface IReferenceDeck {
  readonly id: string;
  readonly date: string;
  readonly placement: number | null;
  readonly cards: string;
}

export interface IExpectedCard {
  readonly cardIdentifier: string;
  /** Share of the reference decks that play the card, 0 to 1. */
  readonly inclusion: number;
}

export interface IEvalScenario {
  readonly id: string;
  readonly deck: IDeckList;
  readonly heroCard: ICatalogCard;
  readonly pool: readonly ICatalogCard[];
  readonly expected: readonly IExpectedCard[];
  readonly referenceDecks: number;
  /** Where the input deck came from: a provenance note, or the reference deck used for an ablation. */
  readonly inputFrom: string;
}

export function parseDeckCards(cards: string): ReadonlyMap<string, number> {
  const parsed = new Map<string, number>();
  for (const pair of cards.split(/\s+/).filter(Boolean)) {
    const separator = pair.lastIndexOf(':');
    const quantity = Number(pair.slice(separator + 1));
    if (separator <= 0 || !Number.isInteger(quantity) || quantity <= 0) throw new Error(`Not an identifier:quantity pair: "${pair}"`);
    parsed.set(pair.slice(0, separator), (parsed.get(pair.slice(0, separator)) ?? 0) + quantity);
  }
  return parsed;
}

export function formatDeckCards(cards: ReadonlyMap<string, number>): string {
  return [...cards.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cardIdentifier, quantity]) => `${cardIdentifier}:${quantity}`)
    .join(' ');
}

/** Share of the decks that play each card at least once. */
export function inclusionRates(decks: readonly IReferenceDeck[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const deck of decks) {
    for (const cardIdentifier of parseDeckCards(deck.cards).keys()) counts.set(cardIdentifier, (counts.get(cardIdentifier) ?? 0) + 1);
  }
  return new Map([...counts.entries()].map(([cardIdentifier, count]) => [cardIdentifier, count / decks.length]));
}

function slotOf(card: ICatalogCard): string {
  if (card.types.includes(Type.Weapon)) return 'weapon';
  if (card.types.includes(Type.Equipment)) return 'equipment';
  return 'mainboard';
}

function toDeckList(spec: IEvalSpec, cards: ReadonlyMap<string, number>, catalog: ICatalog): IDeckList {
  const rows: IDeckListCard[] = [...cards.entries()]
    .filter(([cardIdentifier]) => cardIdentifier !== spec.heroIdentifier)
    .map(([cardIdentifier, quantity]) => ({ cardIdentifier, slot: slotOf(catalog.getCard(cardIdentifier)), quantity }));
  return { heroIdentifier: spec.heroIdentifier, format: spec.format, cards: [{ cardIdentifier: spec.heroIdentifier, slot: 'hero', quantity: 1 }, ...rows] };
}

/** Staples sorted by inclusion, most played first, ties by identifier so the order never depends on the snapshot's order. */
function staples(rates: ReadonlyMap<string, number>): IExpectedCard[] {
  return [...rates.entries()]
    .filter(([, inclusion]) => inclusion >= STAPLE_INCLUSION)
    .map(([cardIdentifier, inclusion]) => ({ cardIdentifier, inclusion }))
    .sort((a, b) => b.inclusion - a.inclusion || a.cardIdentifier.localeCompare(b.cardIdentifier));
}

/** Best placement first, then the most recent, then the id. */
export function pickAblationDeck(decks: readonly IReferenceDeck[]): IReferenceDeck {
  const placement = (deck: IReferenceDeck): number => deck.placement ?? Number.POSITIVE_INFINITY;
  const [best] = [...decks].sort((a, b) => placement(a) - placement(b) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  if (!best) throw new Error('No reference deck to ablate');
  return best;
}

function inPool(pool: readonly ICatalogCard[]): (card: IExpectedCard) => boolean {
  const identifiers = new Set(pool.map((card) => card.cardIdentifier));
  return (card) => identifiers.has(card.cardIdentifier);
}

/**
 * Turns a spec and its reference decks into the deck, the candidate pool the production prompt would show, and the
 * cards a good recommendation must rank high: the staples of the reference decks that the deck lacks and the pool holds.
 * An ablation computes inclusion without the ablated deck, so the deck never votes for its own missing cards.
 */
export function buildEvalScenario(spec: IEvalSpec, referenceDecks: readonly IReferenceDeck[], catalog: ICatalog): IEvalScenario {
  if (referenceDecks.length < MIN_REFERENCE_DECKS) {
    throw new Error(`${spec.id}: ${referenceDecks.length} reference decks, at least ${MIN_REFERENCE_DECKS} are needed`);
  }
  const heroCard = catalog.getCard(spec.heroIdentifier);
  const poolOf = (deck: IDeckList): readonly ICatalogCard[] => buildRecommendationPool(deck, heroCard, new Set(), catalog);

  if (spec.input.kind === 'deck') {
    const deck = toDeckList(spec, parseDeckCards(spec.input.cards), catalog);
    const pool = poolOf(deck);
    const expected = staples(inclusionRates(referenceDecks)).filter(inPool(pool));
    return { id: spec.id, deck, heroCard, pool, expected, referenceDecks: referenceDecks.length, inputFrom: spec.input.provenance };
  }

  const ablated = pickAblationDeck(referenceDecks);
  const others = referenceDecks.filter((deck) => deck.id !== ablated.id);
  const cards = parseDeckCards(ablated.cards);
  const removable = new Set(poolOf(toDeckList(spec, new Map(), catalog)).map((card) => card.cardIdentifier));
  const removed = staples(inclusionRates(others))
    .filter((card) => cards.has(card.cardIdentifier) && removable.has(card.cardIdentifier))
    .slice(0, spec.input.remove);
  const kept = new Map([...cards.entries()].filter(([cardIdentifier]) => !removed.some((card) => card.cardIdentifier === cardIdentifier)));
  const deck = toDeckList(spec, kept, catalog);
  const pool = poolOf(deck);
  return { id: spec.id, deck, heroCard, pool, expected: removed.filter(inPool(pool)), referenceDecks: others.length, inputFrom: `reference deck ${ablated.id}` };
}
