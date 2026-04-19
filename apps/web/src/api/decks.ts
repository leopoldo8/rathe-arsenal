import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { IShoppingLineResponse } from './shopping-line';

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
  /** Shopping line data for this deck, if available. Added in Phase 1b. */
  readonly shoppingLine?: IShoppingLineResponse;
}

/**
 * Response envelope for `GET /api/decks`. `collectionCardCount` is exposed
 * for the home state machine and forward-compatibility with Phase 1c.
 *
 * `aggregateShoppingLine` is added in Phase 1b for the home page callout
 * card ("R$ 312 completaria 4 de 6 decks na Cupula DT").
 */
export interface ITrackedDeckListResponse {
  readonly trackedDecks: readonly ITrackedDeckListItem[];
  readonly collectionCardCount: number;
  /**
   * Aggregate shopping line across all tracked decks. Added in Phase 1b (U10).
   * null = no tracked decks with missing cards.
   */
  readonly aggregateShoppingLine: {
    readonly storeName: string;
    readonly storeSlug: string;
    readonly totalCostCents: number;
    readonly completableDecks: number;
    readonly totalDecks: number;
    /**
     * Discriminant render guard. 'unscraped' = store not yet scraped;
     * home.tsx:142 uses `agg.kind === 'unscraped'` to suppress the callout.
     */
    readonly kind: 'populated' | 'unscraped';
    /**
     * Unique cardIdentifier count across all tracked decks' missing cards.
     * Used for the home hero "cards missing" stat (R23a).
     */
    readonly uniqueCardsMissing: number;
  } | null;
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
    queryFn: () => apiFetch<ITrackedDeckListResponse>('/decks'),
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
