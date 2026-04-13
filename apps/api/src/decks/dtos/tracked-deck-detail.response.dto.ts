import { IShoppingLineResponse } from '../../stores/dtos/shopping-line.response.dto';

export { IShoppingLineResponse };

export interface IBreakdownEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot: string;
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
   * Number of persisted rejections for this deck (U7). The web UI
   * renders the modified-view banner when this is > 0.
   */
  readonly rejectionCount: number;
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
