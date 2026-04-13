import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { IShoppingLineResponse } from './shopping-line';

export interface IBreakdownEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot: string;
}

export interface ISubstituteCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly classes: readonly string[];
  readonly pitch: number | null;
  readonly power: number | null;
  readonly defense: number | null;
  readonly keywords: readonly string[];
}

export interface ISubstitutionMatch {
  readonly substitute: ISubstituteCard;
  readonly tier: number;
  readonly score: number;
  readonly rationale: string;
}

export interface ISubstitutedEntry {
  readonly original: IBreakdownEntry;
  readonly match: ISubstitutionMatch;
}

export interface IBreakdown {
  readonly exact: readonly IBreakdownEntry[];
  readonly substituted: readonly ISubstitutedEntry[];
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
 */
export type TPath = 'A' | 'B' | 'C';

export interface IDeckDetailSnapshot {
  readonly id: number;
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly path: TPath;
  /**
   * Tier-weighted fidelity score (0-100). Not pre-rounded; format for
   * display with `Math.round(fidelityPercent * 10) / 10` or equivalent.
   */
  readonly fidelityPercent: number;
  readonly breakdown: IBreakdown;
  readonly computedAt: string;
}

export interface IDeckDetailResponse {
  readonly id: number;
  readonly fabraryUlid: string;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly trackedAt: string;
  readonly totalCards: number;
  readonly latestSnapshot: IDeckDetailSnapshot | null;
  /**
   * Number of persisted substitution rejections on this deck (U7).
   * The deck detail page renders a modified-view banner when > 0.
   */
  readonly rejectionCount: number;
  /** Shopping line data for this deck. Added in Phase 1b Unit 5. */
  readonly shoppingLine?: IShoppingLineResponse;
}

export interface IMarkOwnedResponse {
  readonly cardIdentifier: string;
  readonly newQuantity: number;
  readonly snapshot: IDeckDetailSnapshot;
}

const DECK_DETAIL_KEY = 'deck-detail' as const;

export function deckDetailQueryKey(deckId: string): readonly [string, string] {
  return [DECK_DETAIL_KEY, deckId] as const;
}

export function useDeckDetailQuery(deckId: string) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: deckDetailQueryKey(deckId),
    queryFn: () => apiFetch<IDeckDetailResponse>(`/decks/${deckId}`),
  });
}

export function useMarkOwnedMutation(deckId: string) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardIdentifier: string) =>
      apiFetch<IMarkOwnedResponse>('/collection/mark-owned', {
        method: 'POST',
        body: JSON.stringify({ deckId: Number(deckId), cardIdentifier }),
      }),
    onSuccess: () => {
      // Invalidate both detail and list queries to refetch with fresh data
      void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(deckId) });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}
