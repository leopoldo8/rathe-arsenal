import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { deckDetailQueryKey } from './deck-detail';
import { VARIANT_JOBS_QUERY_KEY } from './variant-jobs';

/**
 * Response from `POST /api/decks/:deckId/fetch-variants`.
 *
 * Mirrors the backend `IVariantFetchResponse` shape.
 * Possible status values:
 *  - 'started'          202 — job enqueued; jobId + jobStatus returned
 *  - 'in_progress'      202 — a fetch is already running; returns existing state (legacy)
 *  - 'already_fresh'    200 — all missing cards have recent variant data
 *  - 'nothing_to_fetch' 200 — deck has no missing cards
 */
export type TVariantFetchStatus =
  | 'started'
  | 'in_progress'
  | 'already_fresh'
  | 'nothing_to_fetch';

/**
 * New queue-based response: POST enqueues a job and returns its ID + initial status.
 */
export interface IVariantFetchStartedResponse {
  readonly status: 'started';
  readonly jobId: string;
  readonly jobStatus: 'pending' | 'running';
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
      // Refresh the global queue immediately so the navbar indicator + drawer
      // appear on click. Without this, the variant-jobs query only polls while
      // a job is already active, so a freshly enqueued job stayed invisible
      // until a manual page reload.
      void queryClient.invalidateQueries({
        queryKey: VARIANT_JOBS_QUERY_KEY,
      });
    },
  });
}
