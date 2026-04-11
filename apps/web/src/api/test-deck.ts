import { useMutation } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

export interface ITestDeckBreakdownEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot: string;
}

export interface ITestDeckSubstituteCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly classes: readonly string[];
  readonly pitch: number | null;
  readonly power: number | null;
  readonly defense: number | null;
  readonly keywords: readonly string[];
}

export interface ITestDeckSubstitutionMatch {
  readonly substitute: ITestDeckSubstituteCard;
  readonly tier: number;
  readonly score: number;
  readonly rationale: string;
}

export interface ITestDeckSubstitutedEntry {
  readonly original: ITestDeckBreakdownEntry;
  readonly match: ITestDeckSubstitutionMatch;
}

export interface ITestDeckBreakdown {
  readonly exact: readonly ITestDeckBreakdownEntry[];
  readonly substituted: readonly ITestDeckSubstitutedEntry[];
  readonly missing: readonly ITestDeckBreakdownEntry[];
}

export type TTestDeckPath = 'A' | 'B' | 'C';

export interface ITestDeckResponse {
  readonly fabraryUlid: string;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly totalCards: number;
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly path: TTestDeckPath;
  readonly fidelityPercent: number;
  readonly breakdown: ITestDeckBreakdown;
  readonly alreadyTracked: boolean;
  readonly trackedDeckId: number | null;
}

/**
 * Calls `POST /api/decks/test`. Returns a fresh readiness result for a
 * Fabrary URL without persisting anything -- the "out of onboarding"
 * test mode from R15.
 *
 * The mutation key is intentionally omitted so it is not cached:
 * every click of the "Test" button should hit the API (and therefore
 * Fabrary via the SSRF-guarded fetch path).
 */
export function useTestDeckMutation() {
  const apiFetch = useApiClient();
  return useMutation({
    mutationFn: (url: string) =>
      apiFetch<ITestDeckResponse>('/decks/test', {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),
  });
}
