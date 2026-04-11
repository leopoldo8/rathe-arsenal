import { IReadinessBreakdown } from './types';
import { TSubstitutionTier } from '../substitution/types';

/**
 * Tier weights for the Path C fidelity score.
 *
 * These weights intentionally mirror the Gate 4 signal: tier 1 matches are
 * high-confidence substitutions and earn near-full credit (0.9), while
 * tier 2 matches relax the soft constraints and are explicitly less
 * trusted (0.7). An unweighted `(exact + substituted) / total * 100`
 * formula would hide this difference from the user and is rejected in
 * the plan's Key Technical Decisions.
 *
 * Tier 3 is out of scope for Phase 1a.
 */
const TIER_WEIGHTS: Readonly<Record<TSubstitutionTier, number>> = Object.freeze({
  1: 0.9,
  2: 0.7,
});

/**
 * Compute the tier-weighted fidelity percentage for a readiness breakdown.
 *
 * Formula:
 *   fidelityPercent =
 *     ((exactCount * 1.0) + Σ(tierWeight(sub.tier) * sub.quantity)) / totalCards * 100
 *   where tierWeight(1) = 0.9, tierWeight(2) = 0.7.
 *
 * This function is pure, synchronous, and framework-free. It can be
 * invoked at read time over a stored breakdown JSONB to derive
 * `fidelityPercent` for legacy snapshots that predate the field — no
 * database migration is required.
 *
 * Edge case: if `totalCards` is zero (e.g. a degenerate empty deck), the
 * function returns `0` rather than `NaN` or `Infinity`.
 *
 * The return value is NOT pre-rounded. Callers (typically the frontend)
 * are responsible for formatting to a user-facing precision.
 */
export function computeFidelity(
  breakdown: IReadinessBreakdown,
  totalCards: number,
): number {
  if (totalCards <= 0) return 0;

  let weightedCount = 0;

  for (const entry of breakdown.exact) {
    weightedCount += entry.quantity;
  }

  for (const entry of breakdown.substituted) {
    const weight = TIER_WEIGHTS[entry.match.tier];
    weightedCount += weight * entry.original.quantity;
  }

  // Missing entries contribute 0 to the numerator by definition.

  return (weightedCount / totalCards) * 100;
}
