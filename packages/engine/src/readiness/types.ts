import { ISubstitutionMatch, IPitchCurve } from '../substitution/types';

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
  readonly breakdown: IReadinessBreakdown;
  readonly substitutions: readonly ISubstitutionMatch[];
  readonly pitchCurve: {
    readonly original: IPitchCurve;
    readonly modified: IPitchCurve;
  };
}
