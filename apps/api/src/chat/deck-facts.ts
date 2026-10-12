import { catalog, findCardLegalityViolation, FORMAT_RULES, ICatalogCard, TSupportedFormat, Type } from '@rathe-arsenal/engine';
import { slotOf, SUPPORTED_FORMATS } from './proposal-validation';

export const DECK_CARD_TEXT_MAX = 300;

const PITCH_NAMES: Readonly<Record<number, 'red' | 'yellow' | 'blue'>> = { 1: 'red', 2: 'yellow', 3: 'blue' };

export interface IDeckRow {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot?: string;
}

export interface IDeckFactsInput {
  readonly heroIdentifier: string | null;
  readonly format: string;
  readonly rows: readonly IDeckRow[];
}

function findCard(cardIdentifier: string): ICatalogCard | null {
  try {
    return catalog.getCard(cardIdentifier);
  } catch {
    return null;
  }
}

function typeLine(card: ICatalogCard): string {
  return [...card.classes, ...card.talents, ...card.types, ...card.subtypes].join(' ');
}

function slotFor(row: IDeckRow, card: ICatalogCard | null): string {
  if (row.slot) return row.slot;
  if (card?.types.includes(Type.Hero)) return 'hero';
  return card ? slotOf(card) : 'mainboard';
}

function supportedFormat(format: string): TSupportedFormat | null {
  return (SUPPORTED_FORMATS as readonly string[]).includes(format) ? (format as TSupportedFormat) : null;
}

/** Every card with its text and legality, and the counts a model gets wrong when it adds them up itself. */
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
      pitch: card?.pitch ?? null,
      typeLine: card ? typeLine(card) : null,
      text: (card?.functionalText ?? '').slice(0, DECK_CARD_TEXT_MAX),
      ...(card && hero && format ? { legal: findCardLegalityViolation(card, hero, format) === null } : {}),
    };
  });
  const bySlot: Record<string, number> = {};
  const mainboardByPitch: Record<string, number> = { red: 0, yellow: 0, blue: 0, noPitch: 0 };
  for (const card of cards) {
    bySlot[card.slot] = (bySlot[card.slot] ?? 0) + card.quantity;
    if (card.slot !== 'mainboard') continue;
    const pitch = card.pitch === null ? 'noPitch' : (PITCH_NAMES[card.pitch] ?? 'noPitch');
    mainboardByPitch[pitch] = mainboardByPitch[pitch]! + card.quantity;
  }
  const rules = format ? FORMAT_RULES[format] : null;
  return {
    totals: {
      bySlot,
      mainboardByPitch,
      cardPool: cards.filter((card) => card.slot !== 'hero').reduce((sum, card) => sum + card.quantity, 0),
      illegalCards: cards.filter((card) => card.legal === false).map((card) => card.cardIdentifier),
    },
    ...(rules
      ? { formatRules: { minMainboard: rules.minMainboard, exactMainboard: rules.exactMainboard, maxCardPool: rules.maxCardPool, maxCopies: rules.maxCopies } }
      : {}),
    cards,
  };
}
