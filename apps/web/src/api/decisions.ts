import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { deckDetailQueryKey } from './deck-detail';

export interface IDecision {
  readonly cardIdentifier: string;
  readonly decision: 'approved' | 'rejected';
}

export interface IUpsertDecisionBody {
  readonly cardIdentifier: string;
  readonly decision: 'approved' | 'rejected';
}

export interface IClearRejectionsResponse {
  readonly cleared: number;
}

/**
 * Upsert a substitution decision (approve or reject) for a card in a tracked
 * deck. Dual-invalidates both the deck list and deck detail queries on success.
 *
 * Note: optimistic-with-rollback (onMutate/onError) is deferred to Unit 17.
 * This hook performs simple invalidation only.
 */
export function useDecideSubstitutionMutation(deckId: string) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: IUpsertDecisionBody) =>
      apiFetch<IDecision>(`/decks/${deckId}/decisions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: deckDetailQueryKey(deckId),
      });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

/**
 * Reset a single card's decision back to pending (deletes the row).
 * Dual-invalidates both the deck list and deck detail queries on success.
 */
export function useResetDecisionsMutation(deckId: string) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardIdentifier: string) =>
      apiFetch<void>(`/decks/${deckId}/decisions/${encodeURIComponent(cardIdentifier)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: deckDetailQueryKey(deckId),
      });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

/**
 * Bulk-clear all rejections for a deck (preserves approvals).
 * Powers the "Clear rejections" banner action (Unit 16).
 * Dual-invalidates both the deck list and deck detail queries on success.
 */
export function useClearDeckRejectionsMutation(deckId: string) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<IClearRejectionsResponse>(`/decks/${deckId}/decisions?scope=rejections`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: deckDetailQueryKey(deckId),
      });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}
