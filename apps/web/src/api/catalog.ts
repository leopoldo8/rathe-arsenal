import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

export interface ISearchCardResult {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly classes: readonly string[];
  readonly types: readonly string[];
  readonly ownedQuantity: number;
}

export interface ISearchCardsResponse {
  readonly results: readonly ISearchCardResult[];
}

export const CATALOG_SEARCH_QUERY_KEY = ['catalog', 'search'] as const;

const DEFAULT_LIMIT = 10;
const MIN_QUERY_LENGTH = 2;

/**
 * Fetches autocomplete results for a card-name search. The hook is guarded
 * by `enabled: query.length >= 2` so the API is never called with queries
 * that would be rejected at the DTO layer.
 */
export function useSearchCardsQuery(query: string, limit: number = DEFAULT_LIMIT) {
  const apiFetch = useApiClient();
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...CATALOG_SEARCH_QUERY_KEY, trimmed, limit] as const,
    queryFn: () =>
      apiFetch<ISearchCardsResponse>(
        `/catalog/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
      ),
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  });
}
