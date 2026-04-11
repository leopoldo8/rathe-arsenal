import { ICatalogCard } from '../catalog/types';

export type TSubstitutionTier = 1 | 2;

export interface ISubstitutionMatch {
  readonly substitute: ICatalogCard;
  readonly tier: TSubstitutionTier;
  readonly score: number;
  readonly rationale: string;
}

/**
 * Per-tier scoring configuration. Higher tiers relax softer constraints
 * (keywords, stat deltas) but must keep the hard structural constraints
 * (pitch, class, type, equipment slot) shared across all tiers.
 *
 * `keywordPenaltyWeight` controls how heavily a missing keyword overlap
 * is penalized. Tier 1 uses the strict weight (0.35) and gates zero
 * overlap as a hard rejection. Tier 2 softens the penalty so zero
 * overlap can still clear the tier 2 floor.
 */
export interface ITierConfig {
  readonly tier: TSubstitutionTier;
  readonly requireKeywordOverlap: boolean;
  readonly keywordPenaltyWeight: number;
  readonly maxPowerDelta: number;
  readonly maxDefenseDelta: number;
  readonly floorScore: number;
}

export interface IPitchCurve {
  readonly red: number;
  readonly yellow: number;
  readonly blue: number;
  readonly colorless: number;
}

export interface IPitchDelta {
  readonly red: number;
  readonly yellow: number;
  readonly blue: number;
}

export interface IPitchTolerance {
  readonly red: number;
  readonly yellow: number;
  readonly blue: number;
}
