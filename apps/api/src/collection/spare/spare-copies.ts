import type { TSpareRule } from '../../database/entities/user.entity';
import { ICopyVersion } from '../versions/copy-version';

export type TDeckStatus = 'idea' | 'building' | 'ready' | 'active' | 'retired';

/** Only decks at these stages hold copies (AC 155); an Ideia or Aposentado deck holds none. */
export const HOLDING_STATUSES: readonly TDeckStatus[] = ['building', 'ready', 'active'];

export interface ISpareOwnedCopy extends ICopyVersion {
  readonly cardIdentifier: string;
  readonly quantity: number;
}

export interface ISpareDeckLine {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly inventoryQuantity: number;
}

export interface ISpareDeck {
  readonly id: number;
  readonly name: string;
  readonly format: string;
  readonly status: TDeckStatus;
  readonly lines: readonly ISpareDeckLine[];
}

/** What one holding deck uses of a card: its deck copies and its inventory copies. */
export interface IDeckUse {
  readonly deckId: number;
  readonly deckName: string;
  readonly format: string;
  readonly deck: number;
  readonly inventory: number;
  readonly use: number;
}

export interface INonHoldingDeck {
  readonly deckId: number;
  readonly deckName: string;
  readonly status: TDeckStatus;
}

export interface ISpareCard {
  readonly cardIdentifier: string;
  readonly owned: number;
  readonly held: number;
  readonly spare: number;
  /** Holding decks that use the card, the largest use first. */
  readonly holders: readonly IDeckUse[];
  /** Ideia and Aposentado decks that use the card: named, never counted. */
  readonly notHolding: readonly INonHoldingDeck[];
}

export interface ISpareVersionRow extends ICopyVersion {
  readonly cardIdentifier: string;
  readonly spare: number;
}

export interface ISpareResult {
  readonly cards: ReadonlyMap<string, ISpareCard>;
  /** One row per card and version with at least one spare copy. */
  readonly rows: readonly ISpareVersionRow[];
}

export type TSpareCounts = Readonly<Record<TSpareRule, number>>;

// The costlier finish stays in the deck: Cold, Rainbow, Gold, then regular, then unknown (a plan assumption).
const HOLD_ORDER: readonly string[] = ['cold', 'rainbow', 'gold', 'none', ''];

function holdRank(finish: string): number {
  const rank = HOLD_ORDER.indexOf(finish);
  return rank === -1 ? HOLD_ORDER.length : rank;
}

function compareForHolding(a: ISpareOwnedCopy, b: ISpareOwnedCopy): number {
  return (
    holdRank(a.finish) - holdRank(b.finish) ||
    a.printingCode.localeCompare(b.printingCode) ||
    a.edition.localeCompare(b.edition) ||
    a.condition.localeCompare(b.condition)
  );
}

function isHolding(deck: ISpareDeck): boolean {
  return HOLDING_STATUSES.includes(deck.status);
}

function usesOf(deck: ISpareDeck): Map<string, IDeckUse> {
  const uses = new Map<string, IDeckUse>();
  for (const line of deck.lines) {
    const known = uses.get(line.cardIdentifier);
    const deckCopies = (known?.deck ?? 0) + line.quantity;
    const inventory = (known?.inventory ?? 0) + line.inventoryQuantity;
    uses.set(line.cardIdentifier, {
      deckId: deck.id,
      deckName: deck.name,
      format: deck.format,
      deck: deckCopies,
      inventory,
      use: deckCopies + inventory,
    });
  }
  return uses;
}

function heldBy(uses: readonly IDeckUse[], rule: TSpareRule): number {
  if (rule === 'per_deck') return uses.reduce((sum, entry) => sum + entry.use, 0);
  if (rule === 'any_deck') return uses.reduce((most, entry) => Math.max(most, entry.use), 0);
  const largestPerFormat = new Map<string, number>();
  for (const entry of uses) largestPerFormat.set(entry.format, Math.max(largestPerFormat.get(entry.format) ?? 0, entry.use));
  return [...largestPerFormat.values()].reduce((sum, value) => sum + value, 0);
}

/** True when two decks that hold copies use the same card: the only case where the rule changes a count. */
export function decksShareACard(decks: readonly ISpareDeck[]): boolean {
  const seen = new Set<string>();
  for (const deck of decks.filter(isHolding)) {
    for (const cardIdentifier of usesOf(deck).keys()) {
      if (seen.has(cardIdentifier)) return true;
      seen.add(cardIdentifier);
    }
  }
  return false;
}

interface IUsesByCard {
  readonly holders: ReadonlyMap<string, IDeckUse[]>;
  readonly notHolding: ReadonlyMap<string, INonHoldingDeck[]>;
}

function groupUses(decks: readonly ISpareDeck[]): IUsesByCard {
  const holders = new Map<string, IDeckUse[]>();
  const notHolding = new Map<string, INonHoldingDeck[]>();
  for (const deck of decks) {
    for (const [cardIdentifier, use] of usesOf(deck)) {
      if (isHolding(deck)) holders.set(cardIdentifier, [...(holders.get(cardIdentifier) ?? []), use]);
      else notHolding.set(cardIdentifier, [...(notHolding.get(cardIdentifier) ?? []), { deckId: deck.id, deckName: deck.name, status: deck.status }]);
    }
  }
  for (const [cardIdentifier, uses] of holders) {
    holders.set(cardIdentifier, [...uses].sort((a, b) => b.use - a.use || a.deckId - b.deckId));
  }
  return { holders, notHolding };
}

export interface IComputeSpareInput {
  readonly copies: readonly ISpareOwnedCopy[];
  readonly decks: readonly ISpareDeck[];
  readonly rule: TSpareRule;
}

/**
 * The copies a player owns beyond what the holding decks need, under one rule. Pure: nothing is stored, and
 * the holding decks take the foil copies first so the regular ones show as spare first.
 */
export function computeSpare({ copies, decks, rule }: IComputeSpareInput): ISpareResult {
  const { holders, notHolding } = groupUses(decks);
  const byCard = new Map<string, ISpareOwnedCopy[]>();
  for (const copy of copies) {
    if (copy.quantity > 0) byCard.set(copy.cardIdentifier, [...(byCard.get(copy.cardIdentifier) ?? []), copy]);
  }

  const cards = new Map<string, ISpareCard>();
  const rows: ISpareVersionRow[] = [];
  for (const cardIdentifier of [...byCard.keys()].sort()) {
    const versions = [...(byCard.get(cardIdentifier) ?? [])].sort(compareForHolding);
    const owned = versions.reduce((sum, copy) => sum + copy.quantity, 0);
    const cardHolders = holders.get(cardIdentifier) ?? [];
    const held = heldBy(cardHolders, rule);
    let toHold = held;
    for (const copy of versions) {
      const taken = Math.min(toHold, copy.quantity);
      toHold -= taken;
      if (copy.quantity - taken > 0) {
        rows.push({
          cardIdentifier,
          printingCode: copy.printingCode,
          edition: copy.edition,
          finish: copy.finish,
          condition: copy.condition,
          spare: copy.quantity - taken,
        });
      }
    }
    cards.set(cardIdentifier, {
      cardIdentifier,
      owned,
      held,
      spare: Math.max(0, owned - held),
      holders: cardHolders,
      notHolding: notHolding.get(cardIdentifier) ?? [],
    });
  }
  return { cards, rows };
}

/** Every spare copy of the collection under each rule: what the rule question shows next to each option. */
export function countSpareByRule(copies: readonly ISpareOwnedCopy[], decks: readonly ISpareDeck[]): TSpareCounts {
  const total = (rule: TSpareRule): number =>
    [...computeSpare({ copies, decks, rule }).cards.values()].reduce((sum, card) => sum + card.spare, 0);
  return { within_format: total('within_format'), any_deck: total('any_deck'), per_deck: total('per_deck') };
}
