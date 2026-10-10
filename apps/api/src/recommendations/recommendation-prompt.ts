import { createHash } from 'crypto';
import { findCardLegalityViolation, ICatalog, ICatalogCard, TSupportedFormat, Type } from '@rathe-arsenal/engine';

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

const SYSTEM_PROMPT = [
  'You help a Flesh and Blood player improve a deck he already built.',
  "Pick the cards that make the deck's other cards work better and serve its strategy, not the cards that merely resemble the deck's cards.",
  'Judge only from the rules text given. Answer only with cards from the candidate pool, using their exact identifiers.',
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

export function buildRecommendationPool(
  deck: IDeckList,
  heroCard: ICatalogCard,
  dismissed: ReadonlySet<string>,
  catalog: ICatalog,
): readonly ICatalogCard[] {
  const format = deck.format as TSupportedFormat;
  const inDeck = new Set(deck.cards.map((card) => card.cardIdentifier));
  return catalog.cards.filter(
    (card) =>
      !card.types.some((type) => EXCLUDED_POOL_TYPES.has(type)) &&
      !inDeck.has(card.cardIdentifier) &&
      !dismissed.has(card.cardIdentifier) &&
      findCardLegalityViolation(card, heroCard, format) === null,
  );
}

function typeLine(card: ICatalogCard): string {
  return [...card.classes, ...card.talents, ...card.types, ...card.subtypes].join(' ');
}

function cardLine(card: ICatalogCard): string {
  return `${card.cardIdentifier} | ${card.name} | ${typeLine(card)} | ${card.functionalText ?? ''}`;
}

export function buildRecommendationPrompt(
  deck: IDeckList,
  heroCard: ICatalogCard,
  pool: readonly ICatalogCard[],
  catalog: ICatalog,
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
    'Deck (quantity, [slot], identifier | name | type line | rules text):',
    ...deckLines,
    '',
    `Candidate pool (${pool.length} cards, format: identifier | name | type line | rules text):`,
    ...pool.map(cardLine),
    '',
    `Rank the ${RECOMMENDATION_ASK_COUNT} cards from the candidate pool that would best improve this deck, best first.`,
    'For each give: card (its identifier), strength (clear_upgrade or consider), cut (the identifier of the deck card it should replace, or an empty string), one sentence of reason in English, and reason_pt_br, the same sentence in Brazilian Portuguese with card names kept in English.',
  ].join('\n');
  return { system: SYSTEM_PROMPT, prompt };
}
