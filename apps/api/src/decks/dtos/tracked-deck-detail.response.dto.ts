import { IShoppingLineResponse } from '../../stores/dtos/shopping-line.response.dto';

export { IShoppingLineResponse };

export interface IBreakdownEntry {
  readonly cardIdentifier: string;
  /**
   * Human-readable card name from the catalog. Falls back to the identifier
   * when the card is not in the catalog. UI surfaces render `name`.
   */
  readonly name: string;
  readonly quantity: number;
  readonly slot: string;
  /**
   * Card pitch (1 = red, 2 = yellow, 3 = blue).
   * null for pitch-less cards such as heroes, weapons, and equipment (U11).
   */
  readonly pitch: 1 | 2 | 3 | null;
  /**
   * Card cost in resources. null for pitch-less cards (U11).
   */
  readonly cost: number | null;
  /**
   * Primary card type (types[0] from catalog). 'unknown' as defensive fallback (U11).
   */
  readonly type: string;
  /**
   * Public URLs for the card face image (WebP), small + large, served
   * from the LSS public S3 bucket. null when the source card has no
   * image code. Frontend falls back to the <CardArt> SVG placeholder
   * on load error.
   */
  readonly imageUrl:
    | {
        readonly small: string;
        readonly large: string;
        readonly sources: readonly { readonly small: string; readonly large: string }[];
      }
    | null;
}

export interface ISubstitutionEntry {
  readonly substitute: string;
  readonly tier: string;
  readonly score: number;
  readonly rationale: string;
}

export interface IBreakdown {
  readonly exact: readonly IBreakdownEntry[];
  readonly substituted: readonly IBreakdownEntry[];
  readonly missing: readonly IBreakdownEntry[];
  /**
   * All cards the user does not fully own: union of `missing` + originals
   * from `substituted`. Source of truth for the "I own this" affordance.
   */
  readonly notOwned: readonly IBreakdownEntry[];
}

/**
 * Path classification for a readiness snapshot.
 *
 * - **A**: 100% exact coverage.
 * - **B**: missing cards covered by tier 1 or tier 2 substitutions
 *          (effectivePercent = 100).
 * - **C**: some cards remain missing after substitution attempts.
 *
 * Derived at read time by `SubstitutionService.deriveSnapshotFields` so
 * legacy snapshots get the same classification without a migration.
 */
export type TPath = 'A' | 'B' | 'C';

export interface ITrackedDeckDetailSnapshot {
  readonly id: number;
  readonly rawPercent: number;
  readonly effectivePercent: number;
  /** Path classification derived from the breakdown. */
  readonly path: TPath;
  /**
   * Tier-weighted fidelity percentage (0-100) -- primarily consumed by
   * Path C surfaces. Not pre-rounded; frontend formats to display
   * precision.
   */
  readonly fidelityPercent: number;
  readonly breakdown: IBreakdown;
  readonly substitutions: Record<string, ISubstitutionEntry>;
  readonly computedAt: string;
}

/**
 * Per-card decision included in the deck detail response.
 * Only non-pending decisions are included — absence of a row implies pending.
 * Required by Unit 17's optimistic-update snapshot path.
 */
export interface IDecisionEntry {
  readonly cardIdentifier: string;
  readonly decision: 'approved' | 'rejected';
}

export interface ITrackedDeckDetailResponse {
  readonly id: number;
  readonly fabraryUlid: string;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly trackedAt: string;
  readonly totalCards: number;
  readonly latestSnapshot: ITrackedDeckDetailSnapshot | null;
  /**
   * Count of `decision='rejected'` rows for this deck (U9).
   * The web UI renders the modified-view banner when this is > 0.
   * Renamed from `rejectionCount` in U9 to align with the 3-state model.
   */
  readonly rejectedCount: number;
  /**
   * Count of `decision='approved'` rows for this deck (U9).
   */
  readonly approvedCount: number;
  /**
   * Count of non-owned cards without an explicit decision (U9).
   * Derived as: notOwned.length - rejectedCount - approvedCount.
   */
  readonly pendingCount: number;
  /**
   * All non-pending decisions for this deck. Required by Unit 17's
   * optimistic-update snapshot path for per-row decision splicing.
   */
  readonly decisions: readonly IDecisionEntry[];
  /**
   * Shopping line derived at read time from the latest snapshot's breakdown.
   * null = Path A (no missing cards). The discriminated union covers:
   *   - populated: real data available
   *   - unscraped: store exists but no stock rows yet (hide the section)
   *   - error: computation failed (show "temporarily unavailable")
   *
   * Unit 5 (Phase 1b).
   */
  readonly shoppingLine?: IShoppingLineResponse | null;
}
