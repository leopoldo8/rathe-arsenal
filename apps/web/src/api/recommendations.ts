import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { deckDetailQueryKey } from './deck-detail';
import type { IAlternativeImageUrl } from './replacements';
import { SWAPS_QUERY_KEY } from './swaps';

export type TRecommendationStrength = 'clear_upgrade' | 'consider';

export const RECOMMENDATION_FAILURE_CODES = [
  'NO_API_KEY',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_ERROR',
  'MODEL_TIMEOUT',
  'MODEL_REFUSED',
  'MODEL_TRUNCATED',
  'MODEL_OFF_SCHEMA',
  'DECK_INVALID',
  'DECK_RETIRED',
  'WORKER_LOST',
  'SUPERSEDED',
] as const;
export type TRecommendationFailureCode = (typeof RECOMMENDATION_FAILURE_CODES)[number];

export const RECOMMENDATIONS_POLL_MS = 10_000;

export interface IRecommendationCard {
  readonly id: string;
  readonly rank: number;
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly imageUrl: IAlternativeImageUrl | null;
  readonly slot: 'mainboard' | 'equipment';
  readonly strength: TRecommendationStrength;
  readonly reason: string;
  readonly cutCardIdentifier: string | null;
  readonly cutName: string | null;
  readonly cutSlot: string | null;
  readonly freeCopies: number;
  readonly priceCents: number | null;
  readonly productUrl: string | null;
}

export interface IRecommendationsResponse {
  readonly run: {
    readonly id: string;
    readonly status: 'done';
    readonly trigger: 'auto' | 'manual';
    readonly finishedAt: string | null;
    readonly stale: boolean;
  } | null;
  readonly pending: boolean;
  readonly failure: { readonly code: TRecommendationFailureCode; readonly finishedAt: string | null } | null;
  readonly recommendations: readonly IRecommendationCard[];
}

export interface IAdoptVariables {
  readonly recommendationId: string;
  readonly cutCardIdentifier: string;
  readonly cutSlot: string;
}

export function recommendationsQueryKey(deckId: number) {
  return ['recommendations', deckId] as const;
}

export function useRecommendationsQuery(deckId: number) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: recommendationsQueryKey(deckId),
    queryFn: () => apiFetch<IRecommendationsResponse>(`/decks/${deckId}/recommendations`),
    refetchInterval: (query) => (query.state.data?.pending ? RECOMMENDATIONS_POLL_MS : false),
  });
}

function useRefreshRecommendations(deckId: number): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: recommendationsQueryKey(deckId) });
    void queryClient.invalidateQueries({ queryKey: ['decks'] });
  };
}

export function useGenerateRecommendations(deckId: number) {
  const apiFetch = useApiClient();
  const refresh = useRefreshRecommendations(deckId);
  return useMutation({
    mutationFn: () => apiFetch<{ run: unknown }>(`/decks/${deckId}/recommendations/runs`, { method: 'POST' }),
    onSuccess: refresh,
  });
}

export function useDismissRecommendation(deckId: number) {
  const apiFetch = useApiClient();
  const refresh = useRefreshRecommendations(deckId);
  return useMutation({
    mutationFn: (cardIdentifier: string) =>
      apiFetch<{ dismissal: unknown }>(`/decks/${deckId}/recommendations/dismissals`, {
        method: 'POST',
        body: JSON.stringify({ cardIdentifier }),
      }),
    onSuccess: refresh,
  });
}

export function useUndismissRecommendation(deckId: number) {
  const apiFetch = useApiClient();
  const refresh = useRefreshRecommendations(deckId);
  return useMutation({
    mutationFn: (cardIdentifier: string) =>
      apiFetch<void>(`/decks/${deckId}/recommendations/dismissals/${encodeURIComponent(cardIdentifier)}`, {
        method: 'DELETE',
      }),
    onSuccess: refresh,
  });
}

/** An adoption changes the deck list, readiness, swaps, the decks list and the recommendations shown. */
export function useAdoptRecommendation(deckId: number) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  const refresh = useRefreshRecommendations(deckId);
  return useMutation({
    mutationFn: ({ recommendationId, cutCardIdentifier, cutSlot }: IAdoptVariables) =>
      apiFetch<{ replacement: unknown }>(`/decks/${deckId}/recommendations/${recommendationId}/adopt`, {
        method: 'POST',
        body: JSON.stringify({ cutCardIdentifier, cutSlot }),
      }),
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(String(deckId)) });
      void queryClient.invalidateQueries({ queryKey: SWAPS_QUERY_KEY });
    },
  });
}
