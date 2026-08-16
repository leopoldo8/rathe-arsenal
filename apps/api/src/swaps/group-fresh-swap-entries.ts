import { ISubstitutedEntry } from '@rathe-arsenal/engine';
import { IFreshSwapGroup } from './reconcile-swap-suggestions';

/**
 * Collapses the engine's per-copy `breakdown.substituted[]` entries into
 * one `IFreshSwapGroup` per distinct (cardIdentifier, slot,
 * substituteIdentifier) quadruple, with `quantity` set to the count of
 * per-copy entries sharing that key (design/07-swaps.md §2 step 1, §3).
 *
 * Grouping is independent of each entry's `approved` flag -- that flag
 * only affects `effectivePercent` (D7/SWAP-13), never which suggestions
 * get persisted or how they're grouped.
 *
 * Every entry within one group shares an identical tier/score/rationale
 * (`scoreCandidate` is a pure function of the missing card, the candidate,
 * and the tier config only -- inventory exhaustion routes a later copy to
 * a *different* candidate, never the same candidate at a different tier),
 * so tier/confidence/rationale are taken from the first entry seen for a
 * key, never aggregated.
 */
export function groupFreshSwapEntries(
  entries: readonly ISubstitutedEntry[],
): readonly IFreshSwapGroup[] {
  const groups = new Map<string, { -readonly [K in keyof IFreshSwapGroup]: IFreshSwapGroup[K] }>();

  for (const entry of entries) {
    const cardIdentifier = entry.original.cardIdentifier;
    const slot = entry.original.slot;
    const substituteIdentifier = entry.match.substitute.cardIdentifier;
    const key = `${cardIdentifier}::${slot}::${substituteIdentifier}`;

    const existing = groups.get(key);
    if (existing) {
      existing.quantity += 1;
      continue;
    }

    groups.set(key, {
      cardIdentifier,
      slot,
      substituteIdentifier,
      quantity: 1,
      // Tier 3 is not implemented in the engine (find-substitution.ts) --
      // `match.tier` is always 1 or 2 in practice.
      tier: entry.match.tier as 1 | 2,
      confidence: normalizeConfidence(entry.match.score),
      rationale: entry.match.rationale,
    });
  }

  return Array.from(groups.values());
}

/**
 * Translates the engine's 0-1 match score into a 0-100 confidence integer.
 * Mirrors `ReviewAggregateService.normalizeConfidence` exactly -- both
 * read the same engine match shape and must agree on what a given score
 * displays as.
 */
function normalizeConfidence(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const scaled = score <= 1 ? score * 100 : score;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}
