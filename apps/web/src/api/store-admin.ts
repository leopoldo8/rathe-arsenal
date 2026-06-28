import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

/** Single-store iteration — the only store today. */
const STORE_SLUG = 'cupula-dt';

export type TUrlSyncState = 'idle' | 'queued' | 'running';

export interface IUrlSyncStatus {
  readonly state: TUrlSyncState;
  readonly lastUrlSyncAt: string | null;
  readonly lastProductCount: number | null;
}

export const URL_SYNC_STATUS_QUERY_KEY = ['url-sync-status', STORE_SLUG] as const;

/**
 * Polls the store URL-sync status while a sync is queued or running. Admin-only
 * endpoint — only mount the consumer when the current user is an admin (a 403
 * otherwise).
 */
export function useUrlSyncStatusQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: URL_SYNC_STATUS_QUERY_KEY,
    queryFn: () => apiFetch<IUrlSyncStatus>(`/admin/stores/${STORE_SLUG}/url-sync-status`),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === 'queued' || state === 'running' ? 4000 : false;
    },
  });
}

export function useTriggerUrlSyncMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ status: 'queued' }>(`/admin/stores/${STORE_SLUG}/url-sync`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: URL_SYNC_STATUS_QUERY_KEY });
    },
  });
}
