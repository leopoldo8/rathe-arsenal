import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { CATALOG_SEARCH_QUERY_KEY } from './catalog';
import { LIBRARY_QUERY_KEY } from './library';

export interface IAddCardRecomputedDeck {
  readonly trackedDeckId: number;
  readonly rawPercent: number;
  readonly effectivePercent: number;
}

export interface IAddCardResponse {
  readonly cardIdentifier: string;
  readonly newQuantity: number;
  readonly recomputedDecks: readonly IAddCardRecomputedDeck[];
}

export interface IAddCardVariables {
  readonly cardIdentifier: string;
  readonly quantity?: number;
}

/**
 * Manual add-card mutation hook. On success, invalidates both the decks
 * query (so readiness numbers and mode transitions refresh) and the
 * catalog-search query (so the just-added card's `ownedQuantity` updates
 * immediately in the dropdown).
 */
export function useAddCardMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: IAddCardVariables) =>
      apiFetch<IAddCardResponse>('/collection/cards', {
        method: 'POST',
        body: JSON.stringify({
          cardIdentifier: variables.cardIdentifier,
          quantity: variables.quantity ?? 1,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] });
      queryClient.invalidateQueries({ queryKey: CATALOG_SEARCH_QUERY_KEY });
    },
  });
}

export interface IDecrementCardVariables {
  readonly cardIdentifier: string;
  readonly sourceId: string;
  readonly quantity?: number;
}

export interface IDecrementCardResponse {
  readonly cardIdentifier: string;
  readonly sourceId: string;
  readonly newQuantity: number;
  readonly removed: boolean;
  readonly recomputedDecks: ReadonlyArray<{
    readonly trackedDeckId: number;
    readonly rawPercent: number;
    readonly effectivePercent: number;
  }>;
}

/**
 * Subtracts from a `(cardIdentifier, sourceId)` row. Powers the `−` half
 * of the hover stepper on /library. On success, invalidates the library
 * + catalog-search + decks queries so the cell, the rail counts, and any
 * affected deck readiness all refresh.
 */
export function useDecrementCardMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: IDecrementCardVariables) =>
      apiFetch<IDecrementCardResponse>('/collection/cards/decrement', {
        method: 'POST',
        body: JSON.stringify({
          cardIdentifier: variables.cardIdentifier,
          sourceId: variables.sourceId,
          quantity: variables.quantity ?? 1,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['decks'] });
      queryClient.invalidateQueries({ queryKey: CATALOG_SEARCH_QUERY_KEY });
    },
  });
}
