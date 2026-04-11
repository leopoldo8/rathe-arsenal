import { ISubstitutionMatch, IPitchCurve } from '../substitution/types';

/**
 * Path classification for a readiness result.
 *
 * - **A**: 100% exact coverage, no substitutions.
 * - **B**: all missing cards covered by substitutions (effective = 100%).
 * - **C**: some cards remain missing even after substitution attempts.
 */
export type TPath = 'A' | 'B' | 'C';

export interface IBreakdownEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot: string;
}

export interface ISubstitutedEntry {
  readonly original: IBreakdownEntry;
  readonly match: ISubstitutionMatch;
}

export interface IReadinessBreakdown {
  readonly exact: readonly IBreakdownEntry[];
  readonly substituted: readonly ISubstitutedEntry[];
  readonly missing: readonly IBreakdownEntry[];
}

export interface IEffectiveReadinessResult {
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly path: TPath;
  readonly breakdown: IReadinessBreakdown;
  readonly substitutions: readonly ISubstitutionMatch[];
  readonly pitchCurve: {
    readonly original: IPitchCurve;
    readonly modified: IPitchCurve;
  };
}
