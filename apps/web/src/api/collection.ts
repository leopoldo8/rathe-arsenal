import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { CATALOG_SEARCH_QUERY_KEY } from './catalog';

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
