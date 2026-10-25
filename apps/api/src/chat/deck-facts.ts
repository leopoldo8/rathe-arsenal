import { catalog, computeDeckLegality, findCardLegalityViolation, FORMAT_RULES, getCopyLimit, TSupportedFormat } from '@rathe-arsenal/engine';
import { countByCost, countByPitch, countByType } from '../common/deck-counts';
import { deckProfile } from './deck-profile';
import { findCard, IDeckRow, mainboardCards, slotFor, typeLine } from './deck-rows';
import { SUPPORTED_FORMATS } from './proposal-validation';

export type { IDeckRow } from './deck-rows';

export const DECK_CARD_TEXT_MAX = 300;

export interface IDeckFactsInput {
  readonly heroIdentifier: string | null;
  readonly format: string;
  readonly rows: readonly IDeckRow[];
}

export function mainboardByCost(rows: readonly IDeckRow[]): Record<string, number> {
  return countByCost(mainboardCards(rows));
}

function supportedFormat(format: string): TSupportedFormat | null {
  return (SUPPORTED_FORMATS as readonly string[]).includes(format) ? (format as TSupportedFormat) : null;
}

/** The engine's verdict for the whole deck: every problem at once, copies counted per name and pitch across the pool. */
function legalityOf(input: IDeckFactsInput, format: TSupportedFormat): Record<string, unknown> {
  const result = computeDeckLegality(
    {
      heroIdentifier: input.heroIdentifier,
      cards: input.rows.map((row) => ({
        cardIdentifier: row.cardIdentifier,
        quantity: row.quantity,
        slot: slotFor(row, findCard(row.cardIdentifier)),
        ...(row.inventoryQuantity === undefined ? {} : { inventoryQuantity: row.inventoryQuantity }),
      })),
    },
    catalog,
    format,
  );
  return { category: result.category, reasons: [...result.reasons], details: result.details.map((detail) => ({ code: detail.code, params: { ...detail.params } })) };
}

/** Every card with its text, cost and legality, and the counts a model gets wrong when it adds them up itself. */
export function describeDeck(input: IDeckFactsInput): Record<string, unknown> {
  const format = supportedFormat(input.format);
  const hero = input.heroIdentifier ? findCard(input.heroIdentifier) : null;
  const cards = input.rows.map((row) => {
    const card = findCard(row.cardIdentifier);
    return {
      cardIdentifier: row.cardIdentifier,
      name: card?.name ?? row.cardIdentifier,
      slot: slotFor(row, card),
      quantity: row.quantity,
      ...(row.inventoryQuantity ? { inventoryQuantity: row.inventoryQuantity } : {}),
      pitch: card?.pitch ?? null,
      cost: card?.cost ?? null,
      power: card?.power ?? null,
      defense: card?.defense ?? null,
      typeLine: card ? typeLine(card) : null,
      text: (card?.functionalText ?? '').slice(0, DECK_CARD_TEXT_MAX),
      ...(card && hero && format ? { legal: findCardLegalityViolation(card, hero, format) === null } : {}),
      ...(card && format ? { copyLimit: getCopyLimit(card, format) } : {}),
    };
  });
  const bySlot: Record<string, number> = {};
  for (const card of cards) bySlot[card.slot] = (bySlot[card.slot] ?? 0) + card.quantity;
  const mainboard = mainboardCards(input.rows);
  const rules = format ? FORMAT_RULES[format] : null;
  const verdict = format ? legalityOf(input, format) : null;
  return {
    totals: {
      bySlot,
      mainboardByPitch: countByPitch(mainboard),
      mainboardByCost: countByCost(mainboard),
      mainboardByType: countByType(mainboard),
      cardPool: cards.filter((card) => card.slot !== 'hero').reduce((sum, card) => sum + card.quantity, 0),
      illegalCards: cards.filter((card) => card.legal === false).map((card) => card.cardIdentifier),
      ...deckProfile(input.rows),
    },
    ...(verdict ? { legality: verdict } : {}),
    ...(rules
      ? { formatRules: { minMainboard: rules.minMainboard, exactMainboard: rules.exactMainboard, maxCardPool: rules.maxCardPool, maxCopies: rules.maxCopies } }
      : {}),
    cards,
  };
}
