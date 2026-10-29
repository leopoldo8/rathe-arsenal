import {
  computeDeckLegality,
  findCardLegalityViolation,
  getCopyLimit,
  ICatalog,
  ICatalogCard,
  TSupportedFormat,
  Type,
} from '@rathe-arsenal/engine';
import { IDeckProposalPayload, ISwapProposalPayload, TSwapSide } from '../database/entities/chat-proposal.entity';
import { decideAdoption } from '../replacements/adoption-rules';
import {
  DECK_PROPOSAL_ROWS_MAX,
  InvalidToolArguments,
  readInteger,
  readList,
  readString,
  TOOL_REASON_MAX,
} from './chat-tools';

export const SUPPORTED_FORMATS: readonly TSupportedFormat[] = ['Classic Constructed', 'Blitz', 'Living Legend', 'Silver Age'];
const DECK_NAME_MAX = 120;
const HERO_CODES = new Set(['hero_unrecognized', 'hero_not_legal', 'young_hero_required', 'adult_hero_required']);

export type TProposalError =
  | 'HERO_INVALID'
  | 'CARD_UNKNOWN'
  | 'CARD_ILLEGAL'
  | 'SLOT_MISMATCH'
  | 'COPY_LIMIT'
  | 'DECK_NOT_FOUND'
  | 'NOTHING_TO_REPLACE'
  | 'REPLACEMENT_ILLEGAL'
  | 'INVALID_ARGUMENTS';

export type TProposalCheck<T> =
  | { readonly ok: true; readonly payload: T; readonly reason: string }
  | { readonly ok: false; readonly error: TProposalError; readonly detail: string };

export type TSwapProposalCheck =
  | (Extract<TProposalCheck<ISwapProposalPayload>, { ok: true }> & { readonly copies: number })
  | Extract<TProposalCheck<ISwapProposalPayload>, { ok: false }>;

export interface ISwapDeck {
  readonly heroIdentifier: string | null;
  readonly format: string;
  readonly cards: readonly {
    readonly cardIdentifier: string;
    readonly slot: string;
    readonly quantity: number;
    readonly inventoryQuantity?: number;
  }[];
}

function refuse(error: TProposalError, detail: string): Extract<TProposalCheck<never>, { ok: false }> {
  return { ok: false, error, detail };
}

function findCard(catalog: ICatalog, cardIdentifier: string): ICatalogCard | null {
  try {
    return catalog.getCard(cardIdentifier);
  } catch {
    return null;
  }
}

export function slotOf(card: ICatalogCard): 'weapon' | 'equipment' | 'mainboard' {
  if (card.types.includes(Type.Weapon)) return 'weapon';
  if (card.types.includes(Type.Equipment)) return 'equipment';
  return 'mainboard';
}

function readDeckArgs(args: Record<string, unknown>) {
  const name = readString(args, 'name', { max: DECK_NAME_MAX })!.trim();
  if (!name) throw new InvalidToolArguments('name is required');
  const format = readString(args, 'format')!;
  if (!(SUPPORTED_FORMATS as readonly string[]).includes(format)) throw new InvalidToolArguments(`format must be one of ${SUPPORTED_FORMATS.join(', ')}`);
  const rows = readList(args, 'cards', DECK_PROPOSAL_ROWS_MAX).map((row) => {
    if (typeof row !== 'object' || row === null) throw new InvalidToolArguments('each card must be an object');
    const entry = row as Record<string, unknown>;
    return {
      cardIdentifier: readString(entry, 'cardIdentifier')!,
      quantity: readInteger(entry, 'quantity', { min: 1, max: 4 })!,
      slot: readString(entry, 'slot')!,
    };
  });
  return {
    name,
    heroIdentifier: readString(args, 'heroIdentifier')!,
    format: format as TSupportedFormat,
    rows,
    reason: readString(args, 'reason', { max: TOOL_REASON_MAX })!,
  };
}

export function validateDeckProposal(args: Record<string, unknown>, catalog: ICatalog): TProposalCheck<IDeckProposalPayload> {
  let input;
  try {
    input = readDeckArgs(args);
  } catch (error) {
    if (error instanceof InvalidToolArguments) return refuse('INVALID_ARGUMENTS', error.message);
    throw error;
  }
  const hero = findCard(catalog, input.heroIdentifier);
  if (!hero || !hero.types.includes(Type.Hero)) return refuse('HERO_INVALID', `${input.heroIdentifier} is not a hero card`);
  const heroCheck = computeDeckLegality({ heroIdentifier: hero.cardIdentifier, cards: [] }, catalog, input.format);
  const heroProblem = heroCheck.details.find((detail) => HERO_CODES.has(detail.code));
  if (heroProblem) return refuse('HERO_INVALID', `${hero.name} cannot lead a ${input.format} deck (${heroProblem.code})`);

  const copies = new Map<string, { card: ICatalogCard; slot: string; quantity: number }>();
  for (const row of input.rows) {
    const card = findCard(catalog, row.cardIdentifier);
    if (!card) return refuse('CARD_UNKNOWN', `${row.cardIdentifier} is not in the catalog`);
    if (card.types.includes(Type.Hero)) return refuse('SLOT_MISMATCH', `${card.cardIdentifier} is a hero; set it as heroIdentifier`);
    if (slotOf(card) !== row.slot) return refuse('SLOT_MISMATCH', `${card.cardIdentifier} goes in ${slotOf(card)}, not ${row.slot}`);
    const violation = findCardLegalityViolation(card, hero, input.format);
    if (violation) return refuse('CARD_ILLEGAL', violation.reason);
    const existing = copies.get(card.cardIdentifier);
    copies.set(card.cardIdentifier, { card, slot: row.slot, quantity: (existing?.quantity ?? 0) + row.quantity });
  }
  for (const { card, quantity } of copies.values()) {
    const limit = getCopyLimit(card, input.format);
    if (quantity > limit) return refuse('COPY_LIMIT', `${card.cardIdentifier}: ${quantity} copies, limit ${limit}`);
  }
  return {
    ok: true,
    reason: input.reason,
    payload: {
      name: input.name,
      heroIdentifier: hero.cardIdentifier,
      format: input.format,
      cards: [...copies.values()].map(({ card, slot, quantity }) => ({ cardIdentifier: card.cardIdentifier, quantity, slot })),
    },
  };
}

/** What the model asked for: `quantity` and `side` stay as sent so that validation can refuse a wrong one with `ok: false`. */
export interface ISwapRequest {
  readonly trackedDeckId: number;
  readonly originalCardIdentifier: string;
  readonly slot: string;
  readonly replacementCardIdentifier: string;
  readonly reason: string;
  readonly quantity?: unknown;
  readonly side?: unknown;
}

export function readSwapArgs(args: Record<string, unknown>): ISwapRequest {
  return {
    trackedDeckId: readInteger(args, 'deckId', { min: 1 })!,
    originalCardIdentifier: readString(args, 'originalCardIdentifier')!,
    slot: readString(args, 'slot')!,
    replacementCardIdentifier: readString(args, 'replacementCardIdentifier')!,
    reason: readString(args, 'reason', { max: TOOL_REASON_MAX })!,
    quantity: args['quantity'] ?? undefined,
    side: args['side'] ?? undefined,
  };
}

const SWAP_SIDES: readonly TSwapSide[] = ['deck', 'inventory'];

/** `deck` is null when the deck is missing or not the user's. */
export function validateSwapProposal(swap: ISwapRequest, deck: ISwapDeck | null, catalog: ICatalog): TSwapProposalCheck {
  if (!deck) return refuse('DECK_NOT_FOUND', `deck ${swap.trackedDeckId} is not one of the user's decks`);
  if (swap.quantity !== undefined && (typeof swap.quantity !== 'number' || !Number.isInteger(swap.quantity) || swap.quantity < 1)) {
    return refuse('INVALID_ARGUMENTS', 'quantity must be an integer of at least 1');
  }
  if (swap.side !== undefined && !SWAP_SIDES.includes(swap.side as TSwapSide)) {
    return refuse('INVALID_ARGUMENTS', `side must be one of ${SWAP_SIDES.join(', ')}`);
  }
  const side = (swap.side as TSwapSide | undefined) ?? 'deck';
  const original = findCard(catalog, swap.originalCardIdentifier);
  const replacement = findCard(catalog, swap.replacementCardIdentifier);
  if (!original) return refuse('CARD_UNKNOWN', `${swap.originalCardIdentifier} is not in the catalog`);
  if (!replacement) return refuse('CARD_UNKNOWN', `${swap.replacementCardIdentifier} is not in the catalog`);
  const decision = decideAdoption({
    recommended: replacement,
    cut: original,
    cutSlot: swap.slot,
    heroCard: deck.heroIdentifier ? findCard(catalog, deck.heroIdentifier) : null,
    format: deck.format as TSupportedFormat,
    deckCards: deck.cards,
    quantity: swap.quantity as number | undefined,
    side,
  });
  if (decision.kind === 'refuse') return refuse(decision.code, `${swap.originalCardIdentifier} -> ${swap.replacementCardIdentifier} in ${swap.slot}`);
  return {
    ok: true,
    reason: swap.reason,
    copies: decision.quantity,
    payload: {
      trackedDeckId: swap.trackedDeckId,
      originalCardIdentifier: original.cardIdentifier,
      slot: swap.slot,
      replacementCardIdentifier: replacement.cardIdentifier,
      quantity: decision.quantity,
      side,
    },
  };
}
