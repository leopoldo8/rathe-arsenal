/**
 * A single variant record parsed from a store's card detail page.
 *
 * Variants represent the different combinations of edition, condition,
 * and finish available for a single card at a given store.
 *
 * No database columns -- this is a pure transfer object between
 * SbraubleDetailParserService and the persistence layer (Unit 3).
 *
 * Rows where quantity = 0 or price is unavailable are excluded during
 * parsing (they are never included in the returned array).
 */
export interface IScrapedVariant {
  /** Edition code as displayed on the detail page (e.g., "HVY", "U-MON"). */
  readonly edition: string;

  /** Condition string as displayed (e.g., "NM", "LP", "HP"). Passed through as-is. */
  readonly condition: string;

  /**
   * Finish of the card.
   * "non-foil" when the extras cell contains only "-".
   * "foil" when the extras cell contains "Foil".
   */
  readonly finish: 'non-foil' | 'foil';

  /** Price in integer cents (BRL). Always a positive integer -- rows with unavailable prices are excluded. */
  readonly priceCents: number;

  /** Current in-stock quantity. Always > 0 -- zero-stock rows are excluded. */
  readonly quantity: number;
}
