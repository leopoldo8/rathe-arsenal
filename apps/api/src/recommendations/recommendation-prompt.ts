import { createHash } from 'crypto';
import { findCardLegalityViolation, ICatalog, ICatalogCard, TSupportedFormat, Type } from '@rathe-arsenal/engine';
import { IUsageSignal } from './usage-signal';

export const RECOMMENDATION_ASK_COUNT = 25;

export interface IDeckListCard {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly quantity: number;
}

export interface IDeckList {
  readonly heroIdentifier: string | null;
  readonly format: string;
  readonly cards: readonly IDeckListCard[];
}

export interface IRecommendationPrompt {
  readonly system: string;
  readonly prompt: string;
}

const TEXT_ONLY_JUDGMENT = 'Judge only from the rules text given.';
const USAGE_JUDGMENT = [
  'Judge from the rules text given and from how often recent tournament decks for this hero and format play each card.',
  'A card most of those decks play has proven itself with this hero, so rank it high unless this deck already covers its job; a card no deck plays needs a clear reason in its text.',
].join(' ');

const systemPrompt = (judgment: string): string =>
  [
    'You help a Flesh and Blood player improve a deck he already built.',
    "Pick the cards that make the deck's other cards work better and serve its strategy, not the cards that merely resemble the deck's cards.",
    `${judgment} Answer only with cards from the candidate pool, using their exact identifiers.`,
    'Label a card clear_upgrade only when it is plainly better for this deck than the deck card it would replace; label every other pick consider.',
    'For each pick name the deck card it should replace, from the deck list and in the same slot, or an empty string when none fits.',
    "Replace a card of the same role, so the deck keeps its balance of card types: an arrow for an arrow, an arrow buff for an arrow buff, an attack for an attack, a defense card for a defense card.",
    'Prefer the same resource cost as the card replaced; a higher cost is a real downside, not a neutral change.',
    'Count only the parts of a rules text that do something in this deck: an effect that needs something the deck does not have (for example untapping a weapon the deck never taps) adds nothing.',
  ].join(' ');

const EXCLUDED_POOL_TYPES: ReadonlySet<string> = new Set([Type.Hero, Type.Token, Type.Weapon]);

/** The slot an adopted card lands in: equipment for an Equipment card, mainboard for the rest of the pool. */
export function slotForCard(card: ICatalogCard): 'equipment' | 'mainboard' {
  return card.types.includes(Type.Equipment) ? 'equipment' : 'mainboard';
}

export function computeDeckFingerprint(deck: IDeckList): string {
  const copies = new Map<string, number>();
  for (const card of deck.cards) {
    const key = `${card.slot}|${card.cardIdentifier}`;
    copies.set(key, (copies.get(key) ?? 0) + card.quantity);
  }
  const lines = [...copies.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([key, quantity]) => `${key}|${quantity}`)
    .sort();
  const canonical = [`hero|${deck.heroIdentifier ?? ''}`, `format|${deck.format}`, ...lines].join('\n');
  return createHash('sha256').update(canonical).digest('hex');
}

/** A sibling that at least this share of the reference decks plays is kept: players do run that pitch alongside. */
export const PITCH_SIBLING_KEEP_SHARE = 0.5;
/** Cards played by fewer of the reference decks are left out of the usage list, which keeps the prompt short. */
export const USAGE_LISTED_MIN_SHARE = 0.1;

export interface IPoolOptions {
  /** Leave out other pitch versions of cards the deck already plays. */
  readonly dropPitchSiblings?: boolean;
  readonly usage?: IUsageSignal | null;
}

/** Another pitch of a card the deck already plays: the same name, a pitch value, a different identifier. */
export function isPitchSibling(card: ICatalogCard, deckNames: ReadonlySet<string>): boolean {
  return card.pitch !== null && deckNames.has(card.name);
}

function deckCardNames(deck: IDeckList, catalog: ICatalog): Set<string> {
  const names = new Set<string>();
  for (const entry of deck.cards) {
    try {
      names.add(catalog.getCard(entry.cardIdentifier).name);
    } catch {
      // A card retired from the catalog has no name to match.
    }
  }
  return names;
}

export function buildRecommendationPool(
  deck: IDeckList,
  heroCard: ICatalogCard,
  dismissed: ReadonlySet<string>,
  catalog: ICatalog,
  options: IPoolOptions = {},
): readonly ICatalogCard[] {
  const format = deck.format as TSupportedFormat;
  const inDeck = new Set(deck.cards.map((card) => card.cardIdentifier));
  const deckNames = options.dropPitchSiblings ? deckCardNames(deck, catalog) : new Set<string>();
  const droppedSibling = (card: ICatalogCard): boolean =>
    isPitchSibling(card, deckNames) && (options.usage?.shares.get(card.cardIdentifier) ?? 0) < PITCH_SIBLING_KEEP_SHARE;
  return catalog.cards.filter(
    (card) =>
      !card.types.some((type) => EXCLUDED_POOL_TYPES.has(type)) &&
      !inDeck.has(card.cardIdentifier) &&
      !dismissed.has(card.cardIdentifier) &&
      !droppedSibling(card) &&
      findCardLegalityViolation(card, heroCard, format) === null,
  );
}

function typeLine(card: ICatalogCard): string {
  return [...card.classes, ...card.talents, ...card.types, ...card.subtypes].join(' ');
}

function statValue(value: number | null): string {
  return value === null ? '-' : String(value);
}

// The system prompt weighs resource cost, and many heroes and cards key on power
// (Kayo discards cards with 6 or more power), so the model needs the printed numbers.
function statsLine(card: ICatalogCard): string {
  return `cost ${statValue(card.cost)}, pitch ${statValue(card.pitch)}, power ${statValue(card.power)}, defense ${statValue(card.defense)}`;
}

function cardLine(card: ICatalogCard): string {
  return `${card.cardIdentifier} | ${card.name} | ${typeLine(card)} | ${statsLine(card)} | ${card.functionalText ?? ''}`;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Only pool and deck identifiers are written, so nothing from the synced decks reaches the prompt but catalog ids and numbers. */
function usageSection(usage: IUsageSignal, deck: IDeckList, pool: readonly ICatalogCard[]): string[] {
  const inDeck = new Set(deck.cards.filter((entry) => entry.slot !== 'hero').map((entry) => entry.cardIdentifier));
  const listed = new Set([...inDeck, ...pool.map((card) => card.cardIdentifier)]);
  const lines = [...usage.shares.entries()]
    .filter(([cardIdentifier, share]) => listed.has(cardIdentifier) && share >= USAGE_LISTED_MIN_SHARE)
    .sort(([a, shareA], [b, shareB]) => shareB - shareA || a.localeCompare(b))
    .map(([cardIdentifier, share]) => `${cardIdentifier}: ${percent(share)}${inDeck.has(cardIdentifier) ? ' (in the deck)' : ''}`);
  return [
    '',
    `Share of the ${usage.decks} most recent tournament decks for this hero and format that play each card (identifier: share; cards under ${percent(USAGE_LISTED_MIN_SHARE)} left out):`,
    ...lines,
  ];
}

export function buildRecommendationPrompt(
  deck: IDeckList,
  heroCard: ICatalogCard,
  pool: readonly ICatalogCard[],
  catalog: ICatalog,
  usage: IUsageSignal | null = null,
): IRecommendationPrompt {
  const deckLines = deck.cards
    .filter((entry) => entry.slot !== 'hero')
    .map((entry) => {
      let line = entry.cardIdentifier;
      try {
        line = cardLine(catalog.getCard(entry.cardIdentifier));
      } catch {
        // A card retired from the catalog is still listed by identifier.
      }
      return `${entry.quantity}x [${entry.slot}] ${line}`;
    });
  const prompt = [
    `Hero: ${heroCard.name} | ${typeLine(heroCard)} | ${heroCard.functionalText ?? ''}`,
    `Format: ${deck.format}`,
    '',
    'Deck (quantity, [slot], identifier | name | type line | stats | rules text):',
    ...deckLines,
    '',
    `Candidate pool (${pool.length} cards, format: identifier | name | type line | stats | rules text):`,
    ...pool.map(cardLine),
    ...(usage ? usageSection(usage, deck, pool) : []),
    '',
    `Rank the ${RECOMMENDATION_ASK_COUNT} cards from the candidate pool that would best improve this deck, best first.`,
    'For each give: card (its identifier), strength (clear_upgrade or consider), cut (the identifier of the deck card it should replace, or an empty string), one sentence of reason in English, and reason_pt_br, the same sentence in Brazilian Portuguese with card names kept in English.',
    'Name a deck card as the cut no more times than its quantity in the deck.',
  ].join('\n');
  return { system: systemPrompt(usage ? USAGE_JUDGMENT : TEXT_ONLY_JUDGMENT), prompt };
}
