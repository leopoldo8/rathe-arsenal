import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

export interface ICollectorCodePrinting {
  readonly code: string;
  readonly image?: string | null;
}

export interface ICollectorCodeCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly printings: readonly ICollectorCodePrinting[];
}

export interface ICollectorCodesResponse {
  readonly imageSmallBase: string;
  readonly cards: readonly ICollectorCodeCard[];
}

export const COLLECTOR_CODES_QUERY_KEY = ['catalog', 'collector-codes'] as const;

export function useCollectorCodesQuery(): UseQueryResult<ICollectorCodesResponse> {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: COLLECTOR_CODES_QUERY_KEY,
    queryFn: () => apiFetch<ICollectorCodesResponse>('/catalog/collector-codes'),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
