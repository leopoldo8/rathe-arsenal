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
}

export interface ITrackedDeckDetailSnapshot {
  readonly id: number;
  readonly rawPercent: number;
  readonly effectivePercent: number;
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
}
