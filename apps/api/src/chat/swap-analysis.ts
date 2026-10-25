import { catalog, findAlternatives, getCopyLimit, ICatalogCard, TAlternativeGroup, TSupportedFormat } from '@rathe-arsenal/engine';
import { mainboardByCost } from './deck-facts';
import { IDeckRow, typeLine } from './deck-rows';

const CANDIDATES_PER_GROUP = 6;
const CANDIDATE_TEXT_MAX = 200;
const PLAYED_THIS_TURN = /(?:you've|you have) played an? ([A-Z][A-Za-z'\- ]+?) this turn/;

interface IDeckCardRow {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly quantity: number;
  /** Copies carried in the inventory; they count against the copy limit. */
  readonly inventoryQuantity?: number;
}

export interface ISwapCardFacts {
  readonly name: string;
  readonly typeLine: string;
  readonly cost: number | null;
  readonly pitch: number | null;
  readonly power: number | null;
  readonly defense: number | null;
}

export interface ISwapComparison {
  readonly copies: number;
  readonly original: ISwapCardFacts;
  readonly replacement: ISwapCardFacts;
  readonly sameRole: boolean;
  readonly unmetRequirement: string | null;
  readonly costDelta: number | null;
  readonly pitchDelta: number | null;
  readonly powerDelta: number | null;
  readonly defenseDelta: number | null;
  readonly mainboardByCostBefore: Record<string, number>;
  readonly mainboardByCostAfter: Record<string, number>;
}

export interface ISwapCandidate {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly typeLine: string;
  readonly cost: number | null;
  readonly costDelta: number | null;
  readonly pitch: number | null;
  readonly power: number | null;
  readonly defense: number | null;
  readonly sameRole: boolean;
  readonly unmetRequirement: string | null;
  readonly freeCopies: number;
  readonly text: string;
}

export interface ISwapCandidates {
  /** Copies of the card in the slot. */
  readonly copies: number;
  /** Copies the candidates were asked to replace: the quantity given, else the copies over the limit, else every copy. */
  readonly needed: number;
  readonly groups: readonly { readonly group: TAlternativeGroup; readonly cards: readonly ISwapCandidate[] }[];
}

function facts(card: ICatalogCard): ISwapCardFacts {
  return { name: card.name, typeLine: typeLine(card), cost: card.cost, pitch: card.pitch, power: card.power, defense: card.defense };
}

function delta(from: number | null, to: number | null): number | null {
  return from === null || to === null ? null : to - from;
}

function sameValues(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
}

export function hasSameRole(a: ICatalogCard, b: ICatalogCard): boolean {
  return sameValues(a.types, b.types) && sameValues(a.subtypes, b.subtypes);
}

export function unmetRequirement(card: ICatalogCard, otherCards: readonly IDeckCardRow[]): string | null {
  const needed = PLAYED_THIS_TURN.exec(card.functionalText ?? '')?.[1];
  if (needed === undefined) return null;
  const kind = needed.endsWith(' card') ? needed.slice(0, -' card'.length) : null;
  const provides = (row: IDeckCardRow): boolean => {
    const other = catalog.getCard(row.cardIdentifier);
    if (kind === null) return other.name === needed;
    return [...other.classes, ...other.talents, ...other.types, ...other.subtypes].some((value) => String(value) === kind);
  };
  return otherCards.some((row) => row.quantity > 0 && row.cardIdentifier !== card.cardIdentifier && provides(row)) ? null : needed;
}

export function compareSwap(input: {
  readonly original: ICatalogCard;
  readonly replacement: ICatalogCard;
  readonly slot: string;
  readonly quantity: number;
  readonly deckCards: readonly IDeckCardRow[];
}): ISwapComparison {
  const { original, replacement, slot, quantity, deckCards } = input;
  const removed = deckCards.map((row) =>
    row.cardIdentifier === original.cardIdentifier && row.slot === slot ? { ...row, quantity: row.quantity - quantity } : row,
  );
  const after: IDeckRow[] = [...removed, { cardIdentifier: replacement.cardIdentifier, slot, quantity }];
  return {
    copies: quantity,
    original: facts(original),
    replacement: facts(replacement),
    sameRole: hasSameRole(original, replacement),
    unmetRequirement: unmetRequirement(replacement, removed),
    costDelta: delta(original.cost, replacement.cost),
    pitchDelta: delta(original.pitch, replacement.pitch),
    powerDelta: delta(original.power, replacement.power),
    defenseDelta: delta(original.defense, replacement.defense),
    mainboardByCostBefore: mainboardByCost(deckCards),
    mainboardByCostAfter: mainboardByCost(after.filter((row) => row.quantity > 0)),
  };
}

/**
 * How many copies a search for stand-ins covers: the quantity asked for; with none, the copies over the card's limit (counted per
 * name and pitch across the deck and the inventory, as the deck's legality does); with none over, every copy. Never more
 * than the copies in the slot.
 */
export function neededCopies(input: {
  readonly original: ICatalogCard;
  readonly format: TSupportedFormat;
  readonly deckCards: readonly IDeckCardRow[];
  readonly copiesInSlot: number;
  readonly quantity?: number | undefined;
}): number {
  const { original, format, deckCards, copiesInSlot, quantity } = input;
  const all = Math.max(copiesInSlot, 1);
  if (quantity !== undefined) return Math.min(Math.max(quantity, 1), all);
  const total = deckCards
    .filter((row) => {
      const card = catalog.getCard(row.cardIdentifier);
      return card.name === original.name && card.pitch === original.pitch;
    })
    .reduce((sum, row) => sum + row.quantity + (row.inventoryQuantity ?? 0), 0);
  const over = total - getCopyLimit(original, format);
  return over > 0 ? Math.min(over, all) : all;
}

/** `spare` is each card's owned copies that none of the user's decks use. */
export function swapCandidates(input: {
  readonly original: ICatalogCard;
  readonly slot: string;
  readonly heroCard: ICatalogCard;
  readonly format: TSupportedFormat;
  readonly deckCards: readonly IDeckCardRow[];
  readonly spare: ReadonlyMap<string, number>;
  /** Copies to replace; see `neededCopies` for the default. */
  readonly quantity?: number | undefined;
}): ISwapCandidates {
  const { original, slot, heroCard, format, deckCards, spare } = input;
  const deckCopies = new Map<string, number>();
  for (const row of deckCards) deckCopies.set(row.cardIdentifier, (deckCopies.get(row.cardIdentifier) ?? 0) + row.quantity);
  const copies = deckCards
    .filter((row) => row.cardIdentifier === original.cardIdentifier && row.slot === slot)
    .reduce((sum, row) => sum + row.quantity, 0);
  const needed = neededCopies({ original, format, deckCards, copiesInSlot: copies, quantity: input.quantity });
  const owned = new Map([...spare.entries()].map(([cardIdentifier, free]) => [cardIdentifier, free + (deckCopies.get(cardIdentifier) ?? 0)]));
  const groups = findAlternatives({ missing: original, needed, heroCard, format, deckCopies, owned }, catalog);
  return {
    copies,
    needed,
    groups: groups.map((group) => ({
      group: group.group,
      cards: group.cards.slice(0, CANDIDATES_PER_GROUP).map(({ card, freeCopies }) => ({
        cardIdentifier: card.cardIdentifier,
        name: card.name,
        typeLine: typeLine(card),
        cost: card.cost,
        costDelta: delta(original.cost, card.cost),
        pitch: card.pitch,
        power: card.power,
        defense: card.defense,
        sameRole: hasSameRole(original, card),
        unmetRequirement: unmetRequirement(card, deckCards.filter((row) => row.cardIdentifier !== original.cardIdentifier)),
        freeCopies,
        text: (card.functionalText ?? '').slice(0, CANDIDATE_TEXT_MAX),
      })),
    })),
  };
}
