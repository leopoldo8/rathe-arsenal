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

/** Verdict of a deck check; `unchecked` is a format the engine has no rules for. */
export type TLegalityCategory = 'legal' | 'incomplete' | 'illegal' | 'unchecked';

/**
 * The fields of a catalog card the legality rules read, so a client that holds only these
 * (the browser does not load the whole catalog) can run the same check as the server.
 * `ICatalogCard` satisfies it.
 */
export interface ILegalityCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly keywords: readonly string[];
  readonly legalFormats: readonly string[];
  readonly bannedFormats?: readonly string[];
  readonly restrictedFormats?: readonly string[];
  readonly legalHeroes: readonly string[];
  readonly legalOverrides?: readonly { readonly format: string; readonly heroes: readonly string[] }[];
  readonly specializations?: readonly string[];
  readonly hero?: string;
  readonly young: boolean;
}

/** Where `computeDeckLegality` looks cards up. `ICatalog` satisfies it. */
export interface ILegalityCatalog {
  readonly indices: { readonly byIdentifier: ReadonlyMap<string, ILegalityCard> };
}

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
  /** Copies in this slot of the deck. */
  readonly quantity: number;
  readonly slot: string;
  /** Copies carried in the inventory, outside the starting deck. Counts in the pool and the copy limit. */
  readonly inventoryQuantity?: number;
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
  /** One entry per `reasons` string, as a code plus params so clients can localize it. */
  readonly details: readonly TLegalityReasonDetail[];
}

export type TLegalityReasonDetail =
  | { readonly code: 'hero_unrecognized'; readonly params: Record<string, never> }
  | {
      readonly code: 'hero_not_legal';
      readonly params: {
        readonly hero: string;
        readonly format: string;
        /** The supported formats where the hero is allowed, in the engine's format order. */
        readonly allowedFormats: readonly string[];
      };
    }
  | { readonly code: 'young_hero_required'; readonly params: { readonly hero: string; readonly format: string } }
  | { readonly code: 'adult_hero_required'; readonly params: { readonly hero: string; readonly format: string } }
  | {
      readonly code: 'card_pool_too_large' | 'mainboard_not_exact' | 'mainboard_too_small';
      readonly params: { readonly card: null; readonly count: number; readonly limit: number; readonly format: string };
    }
  | {
      readonly code: 'too_many_copies';
      readonly params: {
        readonly card: string;
        readonly cardIdentifier: string;
        readonly pitch: number | null;
        readonly count: number;
        readonly limit: number;
        readonly format: string;
        readonly legendary: boolean;
        readonly restricted: boolean;
      };
    }
  | { readonly code: 'card_unknown'; readonly params: { readonly card: string; readonly cardIdentifier: string } }
  | {
      readonly code: 'card_banned' | 'card_not_in_format';
      readonly params: { readonly card: string; readonly cardIdentifier: string; readonly format: string };
    }
  | {
      readonly code: 'card_not_for_hero';
      readonly params: { readonly card: string; readonly cardIdentifier: string; readonly hero: string };
    };
