/**
 * DTOs for CSV parsing and duplicate detection within the collection module.
 *
 * Naming follows project conventions:
 *   - Interfaces: IPascalCase
 *   - Types/unions: TPascalCase
 *   - Enums: EPascalCase (using const objects for tree-shakeable literals)
 */

/**
 * A single row extracted from the raw CSV after column aliasing but BEFORE
 * catalog resolution. The `set` field is optional; it is only populated when
 * the CSV contains a set/Set/Set Code column.
 */
export interface IParsedCsvRow {
  readonly rowNumber: number;
  readonly name: string;
  readonly rawQuantity: string;
  readonly set?: string;
}

/**
 * A row that was successfully resolved to a catalog card identifier with a
 * valid positive integer quantity.
 */
export interface IResolvedCsvRow {
  readonly rowNumber: number;
  readonly cardIdentifier: string;
  readonly quantity: number;
}

/**
 * Skip reasons for rows that could not be resolved.
 *
 * - `no-match`         — no catalog card found for the given name.
 * - `ambiguous`        — multiple catalog cards share the name and no set
 *                        column was present (or the set column did not narrow
 *                        it to exactly one match).
 * - `invalid-quantity` — quantity is not a positive integer (0, negative, or
 *                        non-numeric).
 * - `empty-name`       — the name cell was blank after trimming.
 */
export type TSkipReason = 'no-match' | 'ambiguous' | 'invalid-quantity' | 'empty-name';

/**
 * A row that was skipped during resolution, retained for diagnostic output.
 */
export interface ISkippedCsvRow {
  readonly rowNumber: number;
  readonly name: string;
  readonly reason: TSkipReason;
}

/**
 * The result of a `CsvParserService.parse()` call. Both arrays are immutable
 * slices; callers must not mutate them.
 */
export interface ICsvParseResult {
  readonly resolved: readonly IResolvedCsvRow[];
  readonly skipped: readonly ISkippedCsvRow[];
}

/**
 * Result of a duplicate-detection check against the user's active CSV sources.
 *
 * Discriminated union on `kind`:
 * - `exact-match`       — the incoming content hash matches an existing source.
 * - `partial-overlap`   — Jaccard similarity ≥ JACCARD_THRESHOLD but no hash
 *                         match; includes a delta and the best-matching source.
 * - `new`               — no meaningful overlap found; treat as a new source.
 */
export type TDuplicateDetectionResult =
  | IExactMatchResult
  | IPartialOverlapResult
  | INewResult;

export interface IExactMatchResult {
  readonly kind: 'exact-match';
  readonly existingSourceId: string;
  readonly existingLabel: string | null;
  readonly cardCount: number;
}

export interface IPartialOverlapResult {
  readonly kind: 'partial-overlap';
  readonly existingSourceId: string;
  readonly existingLabel: string | null;
  readonly similarityScore: number;
  /** Number of unique card identifiers in the best-matching existing source. */
  readonly cardCount: number;
  readonly delta: ICsvDelta;
}

export interface INewResult {
  readonly kind: 'new';
}

/**
 * Delta between an incoming resolved set and an existing source's card set.
 *
 * - `added`     — cards present in incoming but not in existing.
 * - `removed`   — cards present in existing but not in incoming.
 * - `increased` — cards present in both where incoming qty > existing qty.
 * - `decreased` — cards present in both where incoming qty < existing qty.
 */
export interface ICsvDelta {
  readonly added: readonly ICardQuantityEntry[];
  readonly removed: readonly ICardQuantityEntry[];
  readonly increased: readonly ICardQuantityChange[];
  readonly decreased: readonly ICardQuantityChange[];
}

export interface ICardQuantityEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
}

export interface ICardQuantityChange {
  readonly cardIdentifier: string;
  readonly previousQuantity: number;
  readonly newQuantity: number;
}
