import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { deckDetailQueryKey } from './deck-detail';

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

function isActiveJob(job: IVariantJob): boolean {
  return job.status === 'pending' || job.status === 'running';
}

export function hasActiveJobs(data: IVariantJobsResponse): boolean {
  return data.jobs.some(isActiveJob);
}

export function findFinishedJobDeckIds(
  previous: IVariantJobsResponse | undefined,
  next: IVariantJobsResponse,
): number[] {
  if (!previous) return [];
  const stillActive = new Set(next.jobs.filter(isActiveJob).map((j) => j.deckId));
  const finished = previous.jobs
    .filter(isActiveJob)
    .map((j) => j.deckId)
    .filter((deckId) => !stillActive.has(deckId));
  return [...new Set(finished)];
}

function refreshDecks(queryClient: QueryClient, deckIds: readonly number[]): void {
  if (deckIds.length === 0) return;
  for (const deckId of deckIds) {
    void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(String(deckId)) });
  }
  void queryClient.invalidateQueries({ queryKey: ['decks'] });
}

export function useVariantJobsQuery() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: VARIANT_JOBS_QUERY_KEY,
    // Compared inside queryFn so it runs once per fetch, however many components observe the queue.
    queryFn: async () => {
      const previous = queryClient.getQueryData<IVariantJobsResponse>(VARIANT_JOBS_QUERY_KEY);
      const next = await apiFetch<IVariantJobsResponse>('/variant-jobs');
      refreshDecks(queryClient, findFinishedJobDeckIds(previous, next));
      return next;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data && hasActiveJobs(data) ? 4000 : false;
    },
  });
}
