import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { CSV_SOURCES_QUERY_KEY } from './csv-sources';
import { LIBRARY_QUERY_KEY } from './library';

// Mirrors apps/api/src/collection/versions/copy-version.ts and its DTOs.
export type TEdition = 'first' | 'unlimited' | 'alpha';
export type TFinish = 'none' | 'rainbow' | 'cold' | 'gold';
export type TCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';

/** The four parts of a copy's version; `''` is "Não sei". */
export interface ICopyVersion {
  readonly printingCode: string;
  readonly edition: '' | TEdition;
  readonly finish: '' | TFinish;
  readonly condition: '' | TCondition;
}

export const NO_VERSION: ICopyVersion = { printingCode: '', edition: '', finish: '', condition: '' };

export interface ICopiesByVersion extends ICopyVersion {
  readonly quantity: number;
}

export interface ICardVersionPrinting {
  readonly printingCode: string;
  readonly setName: string | null;
  readonly imageUrl: { readonly small: string; readonly large: string } | null;
  readonly editions: readonly TEdition[];
  readonly finishes: readonly TFinish[];
}

export interface ICardVersionOptions {
  readonly cardIdentifier: string;
  readonly printings: readonly ICardVersionPrinting[];
}

export interface ISourceCopy extends ICopiesByVersion {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
}

export interface ISourceCopiesResponse {
  readonly copies: number;
  readonly withoutVersion: number;
  readonly items: readonly ISourceCopy[];
}

export interface IMarkSourceVersionsResponse {
  readonly applied: number;
  readonly skipped: readonly string[];
}

export interface IMarkSourceVersionsVariables {
  readonly sourceId: string;
  readonly edition?: TEdition;
  readonly finish?: TFinish;
  readonly condition?: TCondition;
}

export interface IMoveCopiesVariables {
  readonly cardIdentifier: string;
  readonly from: ICopyVersion;
  readonly to: ICopyVersion;
  readonly quantity: number;
}

export const cardVersionOptionsKey = (cardIdentifier: string) =>
  ['catalog', 'card-versions', cardIdentifier] as const;
export const sourceCopiesKey = (sourceId: string) => ['collection', 'source-copies', sourceId] as const;

/** The printings of one card; the catalog does not change while the page is open. */
export function useCardVersionOptionsQuery(cardIdentifier: string) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: cardVersionOptionsKey(cardIdentifier),
    queryFn: () => apiFetch<ICardVersionOptions>(`/catalog/cards/${encodeURIComponent(cardIdentifier)}/versions`),
    staleTime: Infinity,
  });
}

export function useSourceCopiesQuery(sourceId: string) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: sourceCopiesKey(sourceId),
    queryFn: () => apiFetch<ISourceCopiesResponse>(`/collection/sources/${encodeURIComponent(sourceId)}/copies`),
  });
}

export function useMoveCopiesMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardIdentifier, ...body }: IMoveCopiesVariables) =>
      apiFetch<{ cardIdentifier: string; versions: readonly ICopiesByVersion[] }>(
        `/collection/cards/${encodeURIComponent(cardIdentifier)}/versions`,
        { method: 'PATCH', body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CSV_SOURCES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['collection', 'source-copies'] });
    },
  });
}

export function useMarkSourceVersionsMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, ...body }: IMarkSourceVersionsVariables) =>
      apiFetch<IMarkSourceVersionsResponse>(`/collection/sources/${encodeURIComponent(sourceId)}/versions`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CSV_SOURCES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['collection', 'source-copies'] });
    },
  });
}
