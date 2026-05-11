/**
 * Legality engine types for deck format validation.
 * All types are pure TypeScript — no framework imports.
 */

/** The four formats supported by the legality engine (scope boundary from origin R24). */
export type TSupportedFormat =
  | 'Classic Constructed'
  | 'Blitz'
  | 'Living Legend'
  | 'Silver Age';

/** Three-state legality verdict per Key Technical Decisions. */
export type TLegalityCategory = 'legal' | 'incomplete' | 'illegal';

/**
 * Structural rules for a single supported format.
 * Used by `FORMAT_RULES` in `rules.ts` and consumed by `compute.ts`.
 */
export interface IFormatRules {
  /**
   * Minimum mainboard size. A deck under this count is `'incomplete'` (not `'illegal'`).
   * For CC and LL this is 60; for Blitz and SA this is 40.
   */
  readonly minMainboard: number;
  /**
   * Exact mainboard size required for Blitz and Silver Age.
   * For CC and LL this is null (minimum is checked but no exact requirement).
   * When non-null: deck.mainboard.length !== exactMainboard → `'incomplete'`.
   */
  readonly exactMainboard: number | null;
  /** Maximum total card pool (mainboard + equipment + token etc). */
  readonly maxCardPool: number;
  /**
   * Maximum copies of any non-legendary non-token card.
   * Legendary cards always cap at 1 copy regardless of format.
   */
  readonly maxCopies: number;
  /**
   * When true, the hero card must be a "young" hero variant
   * (upstream `Card.young === true`).
   * Blitz and Silver Age require a young hero; CC and LL require non-young.
   */
  readonly requiresYoungHero: boolean;
  /**
   * When non-null, only cards whose rarity is in this set are allowed.
   * Used for Silver Age which restricts to Common, Rare, and Basic.
   * Null means no rarity restriction beyond the copy-limit rules.
   */
  readonly allowedRarities: ReadonlySet<string> | null;
  /** Canonical LSS source URL for this format's rules. */
  readonly source: string;
}

/** Input deck shape for legality computation. Matches the server-side entity minimum. */
export interface ILegalityDeck {
  /** Identifier of the hero card for this deck. Null triggers the R24a short-circuit. */
  readonly heroIdentifier: string | null;
  /** All cards in the deck (hero + mainboard + equipment + weapon etc.). */
  readonly cards: readonly ILegalityDeckCard[];
}

export interface ILegalityDeckCard {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot: string;
}

/** Result returned by `computeDeckLegality`. */
export interface IDeckLegalityResult {
  /** Three-state verdict. */
  readonly category: TLegalityCategory;
  /**
   * Ordered list of human-readable reason strings.
   * The first entry is used as the badge subtitle (R25).
   * Empty when `category === 'legal'`.
   */
  readonly reasons: readonly string[];
}
