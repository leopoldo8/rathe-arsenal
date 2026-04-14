import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { deckDetailQueryKey } from './deck-detail';

/**
 * Response from `POST /api/decks/:deckId/fetch-variants`.
 *
 * Mirrors the backend `IVariantFetchResponse` shape from Unit 5.
 * Three possible status values:
 *  - 'started'        202 — a new async fetch loop has been started
 *  - 'in_progress'    202 — a fetch is already running; returns existing state
 *  - 'already_fresh'  200 — all missing cards have recent variant data
 *  - 'nothing_to_fetch' 200 — deck has no missing cards
 */
export type TVariantFetchStatus =
  | 'started'
  | 'in_progress'
  | 'already_fresh'
  | 'nothing_to_fetch';

export interface IVariantFetchStartedResponse {
  readonly status: 'started';
  readonly fetchId: string;
  readonly total: number;
}

export interface IVariantFetchInProgressResponse {
  readonly status: 'in_progress';
  readonly fetchId: string;
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
}

export interface IVariantFetchAlreadyFreshResponse {
  readonly status: 'already_fresh';
}

export interface IVariantFetchNothingToFetchResponse {
  readonly status: 'nothing_to_fetch';
}

export type IVariantFetchResponse =
  | IVariantFetchStartedResponse
  | IVariantFetchInProgressResponse
  | IVariantFetchAlreadyFreshResponse
  | IVariantFetchNothingToFetchResponse;

/**
 * Mutation hook that triggers the variant detail fetch for a deck.
 *
 * On success, invalidates the deck-detail query so the component
 * receives fresh data (including any variantFetchProgress) on the
 * next render cycle. The deck-detail query's dynamic `refetchInterval`
 * then drives polling.
 *
 * Cooldown strategy: if the server responds with 'already_fresh', the
 * mutation resolves successfully. Callers can inspect `data.status` to
 * determine whether to show the "already up to date" message instead
 * of a progress indicator.
 */
export function useVariantFetchMutation(deckId: string) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<IVariantFetchResponse>(`/decks/${deckId}/fetch-variants`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: deckDetailQueryKey(deckId),
      });
    },
  });
}
