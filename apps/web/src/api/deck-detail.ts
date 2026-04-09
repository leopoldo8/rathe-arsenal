import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

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
}

export interface IDeckDetailSnapshot {
  readonly id: number;
  readonly rawPercent: number;
  readonly effectivePercent: number;
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
