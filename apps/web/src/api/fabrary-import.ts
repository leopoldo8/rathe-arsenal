import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { findFabraryDeckId } from '../lib/fabrary-link';
import { LIBRARY_QUERY_KEY } from './library';
import { CSV_SOURCES_QUERY_KEY } from './csv-sources';
import { DECKS_QUERY_KEY } from './decks';

// Mirrors apps/api/src/decks/import/dtos/import-decks.response.dto.ts.

export interface IFabraryDeckPreview {
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly totalCards: number;
  readonly ownedCards: number;
}

export interface IImportFabraryDeckVariables {
  /** Any text that holds a Fabrary deck link. */
  readonly text: string;
  /** Required, with no default: whether the deck's cards are the player's. */
  readonly ownsCards: boolean;
}

export interface IImportFabraryDeckResponse {
  readonly deckId: number;
  readonly source?: {
    readonly id: string;
    readonly kind: string;
    readonly label: string;
    readonly cardCount: number;
    readonly copies: number;
  };
}

/** The deck behind the first Fabrary link in the text, with how many of its cards the collection holds. */
export function useFabraryPreviewQuery(text: string) {
  const apiFetch = useApiClient();
  const deckId = findFabraryDeckId(text);
  return useQuery({
    queryKey: ['fabrary-preview', deckId],
    queryFn: () =>
      apiFetch<IFabraryDeckPreview>('/decks/import/preview', { method: 'POST', body: JSON.stringify({ text }) }),
    enabled: deckId !== null,
    retry: false,
    staleTime: 60_000,
  });
}

export function useImportFabraryDeckMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: IImportFabraryDeckVariables) =>
      apiFetch<IImportFabraryDeckResponse>('/decks/import', { method: 'POST', body: JSON.stringify(variables) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CSV_SOURCES_QUERY_KEY });
    },
  });
}
