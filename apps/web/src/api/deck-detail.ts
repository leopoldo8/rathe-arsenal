import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

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

export interface IDeckDetailSnapshot {
  readonly id: number;
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly breakdown: IBreakdown;
  readonly substitutions: Record<string, ISubstitutionEntry>;
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
    onSuccess: (data) => {
      // Optimistically update the deck detail cache with the new snapshot
      queryClient.setQueryData<IDeckDetailResponse>(
        deckDetailQueryKey(deckId),
        (prev) => {
          if (!prev) return prev;
          return { ...prev, latestSnapshot: data.snapshot };
        },
      );
      // Also invalidate to refetch cleanly
      queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(deckId) });
      // Invalidate the list view so percentages update
      queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}
