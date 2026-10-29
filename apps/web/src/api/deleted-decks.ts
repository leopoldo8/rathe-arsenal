import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { DECKS_QUERY_KEY, type TDeckStatus } from './decks';

/** A deck in "Excluídos recentemente": kept 30 days after `deletedAt`, gone for good at `purgeAt`. */
export interface IDeletedDeck {
  readonly id: number;
  readonly name: string;
  readonly status: TDeckStatus;
  readonly format: string;
  readonly totalCards: number;
  readonly deletedAt: string;
  readonly purgeAt: string;
}

export const DELETED_DECKS_QUERY_KEY = ['decks', 'deleted'] as const;

export function useDeletedDecksQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: DELETED_DECKS_QUERY_KEY,
    queryFn: () => apiFetch<{ readonly decks: readonly IDeletedDeck[] }>('/decks/deleted'),
  });
}

/** Brings a deleted deck back through POST /api/decks/:deckId/restore. */
export function useRestoreDeckMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deckId: number) => apiFetch<unknown>(`/decks/${deckId}/restore`, { method: 'POST' }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
    },
  });
}

/** Deletes a deck for good through DELETE /api/decks/:deckId/permanent. */
export function usePermanentDeleteDeckMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deckId: number) => apiFetch<void>(`/decks/${deckId}/permanent`, { method: 'DELETE' }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
    },
  });
}
