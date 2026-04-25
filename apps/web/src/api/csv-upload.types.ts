/**
 * Shared delta/skipped-row types — mirrors the API's csv.types.ts.
 * Extracted to a shared module so both `csv-sources.ts` and
 * any other consumer can import without circular dependencies.
 */

export interface ICardQuantityEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
}

export interface ICardQuantityChange {
  readonly cardIdentifier: string;
  readonly previousQuantity: number;
  readonly newQuantity: number;
}

export interface ICsvDelta {
  readonly added: readonly ICardQuantityEntry[];
  readonly removed: readonly ICardQuantityEntry[];
  readonly increased: readonly ICardQuantityChange[];
  readonly decreased: readonly ICardQuantityChange[];
}

export type TSkipReason = 'no-match' | 'ambiguous' | 'invalid-quantity' | 'empty-name';

export interface ISkippedCsvRow {
  readonly rowNumber: number;
  readonly name: string;
  readonly reason: TSkipReason;
}
