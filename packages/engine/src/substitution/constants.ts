import { IPitchTolerance, ITierConfig } from './types';

/**
 * Tier 1 floor score. Gate 4 validated tier 1 at 73.7% SOFT_CONFIDENCE
 * with this floor; raising or lowering it changes engine acceptance
 * behavior and must be re-validated against the gold set.
 */
export const TIER_1_FLOOR_SCORE = 0.9;

/**
 * Tier 2 floor score. Tier 2 relaxes keyword overlap and widens stat
 * deltas from tier 1, so the score distribution shifts downward; a 0.70
 * floor keeps accepted tier 2 matches in the "70-89% readiness bucket"
 * defined by R22.
 */
export const TIER_2_FLOOR_SCORE = 0.7;

export const DEFAULT_PITCH_TOLERANCE: IPitchTolerance = Object.freeze({
  red: 2,
  yellow: 1,
  blue: 1,
});

/**
 * Scoring weights applied by `scoreCandidate`. `KEYWORD_OVERLAP_WEIGHT`
 * is the tier 1 strict penalty; tier 2 overrides it via `ITierConfig`.
 * Power and defense weights are shared across tiers because the tiers
 * differ only in the allowed delta range, not the per-unit penalty.
 */
export const KEYWORD_OVERLAP_WEIGHT = 0.35;
export const TIER_2_KEYWORD_OVERLAP_WEIGHT = 0.15;
export const POWER_DELTA_WEIGHT = 0.15;
export const DEFENSE_DELTA_WEIGHT = 0.15;
export const BASE_SCORE = 1.0;

/**
 * Tier 1 config: strict keyword overlap requirement, stat deltas capped
 * at 1, floor 0.90. Preserves the Phase 0 tier 1 behavior exactly.
 */
export const TIER_1_CONFIG: ITierConfig = Object.freeze({
  tier: 1,
  requireKeywordOverlap: true,
  keywordPenaltyWeight: KEYWORD_OVERLAP_WEIGHT,
  maxPowerDelta: 1,
  maxDefenseDelta: 1,
  floorScore: TIER_1_FLOOR_SCORE,
});

/**
 * Tier 2 config: keyword overlap relaxed, stat deltas widened to 2,
 * floor 0.70. Keeps the hard structural constraints (pitch, class,
 * type, equipment slot) shared with tier 1.
 *
 * `keywordPenaltyWeight` is softened from 0.35 to 0.15 so that a
 * zero-overlap candidate scores 0.85 (clearing the 0.70 floor) while
 * a full mismatch on keywords + power delta 2 + defense delta 2 still
 * falls below the floor (0.25). The exact weight is validated against
 * the Gate 4 gold set regression.
 */
export const TIER_2_CONFIG: ITierConfig = Object.freeze({
  tier: 2,
  requireKeywordOverlap: false,
  keywordPenaltyWeight: TIER_2_KEYWORD_OVERLAP_WEIGHT,
  maxPowerDelta: 2,
  maxDefenseDelta: 2,
  floorScore: TIER_2_FLOOR_SCORE,
});
