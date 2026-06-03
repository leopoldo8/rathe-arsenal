import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

export interface IVariantJob {
  readonly jobId: string;
  readonly deckId: number;
  readonly deckName: string;
  readonly status: 'pending' | 'running' | 'done' | 'failed' | 'canceled';
  readonly total: number;
  readonly completed: number;
  readonly failed: number;
}

export interface IVariantJobsResponse {
  readonly jobs: readonly IVariantJob[];
  readonly etaSeconds: number;
}

export const VARIANT_JOBS_QUERY_KEY = ['variant-jobs'] as const;

export function hasActiveJobs(data: IVariantJobsResponse): boolean {
  return data.jobs.some((j) => j.status === 'pending' || j.status === 'running');
}

export function useVariantJobsQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: VARIANT_JOBS_QUERY_KEY,
    queryFn: () => apiFetch<IVariantJobsResponse>('/variant-jobs'),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && hasActiveJobs(data) ? 4000 : false;
    },
  });
}
