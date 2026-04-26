import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { LIBRARY_QUERY_KEY } from './library';
import { CSV_SOURCES_QUERY_KEY } from './csv-sources';

export interface IFabraryLibraryImportResponse {
  readonly sourceId: string;
  readonly cardCount: number;
  readonly uniqueCardCount: number;
  readonly deckName: string;
  readonly format: string;
}

export interface IFabraryLibraryImportVariables {
  readonly url: string;
}

/**
 * Imports a public Fabrary deck **as a library Source**, not as a tracked
 * deck. Used by `/add-cards/fabrary`. On success, invalidates the library
 * and CSV-sources queries so both views reflect the new source without
 * a manual refresh.
 */
export function useFabraryLibraryImportMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<
    IFabraryLibraryImportResponse,
    Error,
    IFabraryLibraryImportVariables
  >({
    mutationFn: ({ url }) =>
      apiFetch<IFabraryLibraryImportResponse>(
        '/collection/sources/from-fabrary',
        {
          method: 'POST',
          body: JSON.stringify({ url }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CSV_SOURCES_QUERY_KEY });
    },
  });
}
