import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

export interface ITrackedDeckSnapshot {
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly computedAt: string;
}

export interface ITrackedDeckListItem {
  readonly id: number;
  readonly fabraryUlid: string;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly trackedAt: string;
  readonly latestSnapshot: ITrackedDeckSnapshot | null;
}

export interface IImportDecksResponse {
  readonly imported: ReadonlyArray<{
    readonly trackedDeckId: number;
    readonly name: string;
    readonly hero: string;
    readonly format: string;
    readonly readinessSnapshot: {
      readonly rawPercent: number;
      readonly effectivePercent: number;
    } | null;
  }>;
  readonly skipped: ReadonlyArray<{
    readonly url: string;
    readonly reason: string;
  }>;
  readonly errors: ReadonlyArray<{
    readonly url: string;
    readonly code: string;
    readonly message: string;
  }>;
}

const DECKS_QUERY_KEY = ['decks'] as const;

export function useDecksQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: DECKS_QUERY_KEY,
    queryFn: () => apiFetch<ITrackedDeckListItem[]>('/decks'),
  });
}

export function useImportDecksMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ urls, seedInventory = true }: { urls: string[]; seedInventory?: boolean }) =>
      apiFetch<IImportDecksResponse>('/decks/import', {
        method: 'POST',
        body: JSON.stringify({ urls, seedInventory }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
    },
  });
}

export function useUntrackDeckMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deckId: number) =>
      apiFetch<void>(`/decks/${deckId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
    },
  });
}
