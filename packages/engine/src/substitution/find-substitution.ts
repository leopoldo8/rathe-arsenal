import { ICatalog, ICatalogCard } from '../catalog/types';
import { ISubstitutionMatch } from './types';
import { TIER_1_CONFIG, TIER_2_CONFIG } from './constants';
import { findTierMatch } from './score';
import { TExclusionKey } from './exclusion-key';

/**
 * Tiered substitution search.
 *
 * Attempts tier 1 first. If no tier 1 candidate meets the tier 1 floor,
 * falls back to tier 2 (relaxed keyword overlap + wider stat deltas).
 * Returns the best match at the highest tier that produces a result,
 * or `null` when neither tier finds a candidate.
 *
 * `slot` identifies which deck position `missingCard` occupies -- required
 * so `excludedIdentifiers` (keyed on `(original, slot, substitute)`) can be
 * checked precisely; the same original card in two different slots must be
 * able to carry two independent rejection decisions. `excludedIdentifiers`
 * is threaded through both tier calls so the interactive swap editor can
 * skip rejected substitutes during re-solve. The exclusion set is treated
 * uniformly across tiers — a rejection means "never suggest this card for
 * this slot", regardless of what tier the engine would classify it at.
 *
 * Tier 3 is intentionally not implemented in Phase 1a. Per the Phase 1a
 * plan Scope Boundaries section, tier 3 relaxations depend on effect-aware
 * scoring that is a Phase 2 concern.
 */
export function findSubstitution(
  missingCard: ICatalogCard,
  remainingInventory: ReadonlyMap<string, number>,
  catalog: ICatalog,
  slot: string,
  excludedIdentifiers: ReadonlySet<TExclusionKey> = new Set(),
): ISubstitutionMatch | null {
  const tier1Match = findTierMatch(
    missingCard,
    remainingInventory,
    catalog,
    TIER_1_CONFIG,
    slot,
    excludedIdentifiers,
  );
  if (tier1Match !== null) return tier1Match;

  return findTierMatch(
    missingCard,
    remainingInventory,
    catalog,
    TIER_2_CONFIG,
    slot,
    excludedIdentifiers,
  );
}
