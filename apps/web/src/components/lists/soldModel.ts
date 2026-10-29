export interface ISoldImport {
  readonly sourceId: string;
  readonly label: string;
  /** Copies in this import that a sale of the line may take: its version, or no version. */
  readonly quantity: number;
}

/** What the collection and the decks say about the card of a line being sold. */
export interface ISoldFacts {
  /** Every copy of the card the player owns, whatever the version. */
  readonly owned: number;
  /** Copies the holding decks keep, under the player's rule. */
  readonly held: number;
  /** The deck that keeps the most; null when no holding deck uses the card. */
  readonly holder: string | null;
  readonly imports: readonly ISoldImport[];
}

export type TSoldOutlook =
  | { readonly kind: 'short'; readonly deck: string; readonly missing: number }
  | { readonly kind: 'kept'; readonly left: number; readonly deck: string }
  | { readonly kind: 'left'; readonly left: number };

/** How many copies "Sim" takes out: the copies sold, as far as the collection holds a version of the line. */
export function copiesToTake(facts: ISoldFacts, sold: number): number {
  const removable = facts.imports.reduce((sum, entry) => sum + entry.quantity, 0);
  return Math.min(sold, removable);
}

/** What taking `taken` copies leaves: a deck short, exactly the copies the decks keep, or more than they keep. */
export function soldOutlook(facts: ISoldFacts, taken: number): TSoldOutlook {
  const left = Math.max(facts.owned - taken, 0);
  if (facts.holder === null || facts.held === 0) return { kind: 'left', left };
  if (left < facts.held) return { kind: 'short', deck: facts.holder, missing: facts.held - left };
  if (left === facts.held) return { kind: 'kept', left, deck: facts.holder };
  return { kind: 'left', left };
}
