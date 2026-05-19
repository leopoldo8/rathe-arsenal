import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { IShoppingLineResponse } from './shopping-line';
import { TAGS_QUERY_KEY } from './tags';
import { LIBRARY_QUERY_KEY } from './library';

// ---------------------------------------------------------------------------
// Shared enum / value types (re-exported by deck-detail.ts — do NOT duplicate)
// ---------------------------------------------------------------------------

/**
 * Deck lifecycle status. Matches the CHECK constraint on `tracked_deck.status`.
 */
export type TDeckStatus = 'idea' | 'building' | 'ready' | 'active' | 'retired';

/**
 * Legality assessment for a deck against its configured format.
 *
 * - `legal`: deck satisfies all format rules.
 * - `incomplete`: deck passes structural rules but is missing cards the engine
 *   cannot yet fully evaluate (e.g. hero not set).
 * - `illegal`: one or more format violations detected.
 *
 * `reasons` is non-empty when `category` is `illegal` or `incomplete`.
 */
export interface IDeckLegality {
  readonly category: 'legal' | 'incomplete' | 'illegal';
  readonly reasons: readonly string[];
}

// ---------------------------------------------------------------------------
// PATCH body DTO
// ---------------------------------------------------------------------------

export interface IPatchDeckBody {
  readonly status?: TDeckStatus;
  readonly name?: string;
  readonly addTagIds?: readonly number[];
  readonly removeTagIds?: readonly number[];
}

// ---------------------------------------------------------------------------
// PUT body + response DTOs
// ---------------------------------------------------------------------------

export interface IPutDeckBody {
  readonly cards: readonly { readonly cardIdentifier: string; readonly quantity: number }[];
  readonly heroIdentifier: string | null;
  readonly format: string;
}

export interface IPutDeckResponse {
  readonly id: number;
  readonly name: string;
  readonly hero: string;
  readonly heroIdentifier: string | null;
  readonly format: string;
  readonly status: TDeckStatus;
  readonly tags: readonly string[];
  readonly legality: IDeckLegality;
  readonly updatedAt: string;
  readonly readiness: {
    readonly rawPercent: number;
    readonly effectivePercent: number;
  } | null;
}

// ---------------------------------------------------------------------------
// POST /decks (scratch) body + response DTOs
// ---------------------------------------------------------------------------

export interface ICreateScratchDeckBody {
  readonly heroIdentifier: string | null;
  readonly format: string;
}

export interface ICreateScratchDeckResponse {
  readonly id: number;
  readonly name: string;
  readonly heroIdentifier: string | null;
  readonly format: string;
  readonly status: TDeckStatus;
  readonly trackedAt: string;
}

// ---------------------------------------------------------------------------
// Existing snapshot / card types
// ---------------------------------------------------------------------------

export interface ITrackedDeckSnapshot {
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly computedAt: string;
}

/**
 * Card preview rendered inside the home tile's deckbox vessel on hover.
 * Up to 3 representative mainboard cards lift in a depth-staggered fan
 * when the user hovers/focuses the tile. Empty array → frontend renders
 * default oxblood card-back silhouettes (the hover effect still plays).
 */
export interface IRepresentativeCard {
  readonly cardIdentifier: string;
  readonly name: string;
  /**
   * `small` is the preferred URL; `smallSources` is the ordered fallback
   * list (primary first, then the catalog's `sources` mirror). The frontend
   * walks it in `<img onError>` because Legend Story's CDN 403's some
   * primary assets even when the catalog produces a stable URL.
   */
  readonly imageUrl: {
    readonly small: string;
    readonly smallSources: readonly string[];
  } | null;
}

export interface ITrackedDeckListItem {
  readonly id: number;
  /**
   * Fabrary ULID for decks imported from Fabrary; null for scratch decks
   * created directly in Rathe Arsenal. Made nullable in v2 (U7).
   */
  readonly fabraryUlid: string | null;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly trackedAt: string;
  /** Last time any field on this deck was modified. Added in v2 (U7). */
  readonly updatedAt: string;
  readonly latestSnapshot: ITrackedDeckSnapshot | null;
  /** Lifecycle status for this deck. Added in v2 (U7). */
  readonly status: TDeckStatus;
  /**
   * User-defined tag names attached to this deck (display strings, not IDs).
   * Empty array when no tags. Added in v2 (U7).
   */
  readonly tags: readonly string[];
  /**
   * Legality assessment against the deck's configured format. Added in v2 (U7).
   */
  readonly legality: IDeckLegality;
  /**
   * Hero card thumbnail for the home tile centerpiece. Null when the
   * deck has no snapshot yet, or when the catalog has no image for the
   * hero. Frontend falls back to a neutral oxblood placeholder.
   *
   * `smallSources` mirrors `IRepresentativeCard.imageUrl.smallSources`:
   * an ordered fallback list the frontend walks on `onError`.
   */
  readonly heroImageUrl: {
    readonly small: string;
    readonly smallSources: readonly string[];
  } | null;
  /**
   * Up to 3 representative mainboard cards for the home tile's hover
   * animation. Sorted by quantity desc, name asc.
   */
  readonly representativeCards: readonly IRepresentativeCard[];
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
   * Total physical card copies the user does not own across all tracked decks.
   * Sum of `breakdown.notOwned[].quantity` from each snapshot — counts every
   * needed copy (3x missing of the same card = 3, not 1).
   *
   * Decoupled from `aggregateShoppingLine`: always available from snapshots,
   * even without a priced store. Powers the home "Cards missing" stat
   * unconditionally (no kind check). Null only when no snapshot exists.
   */
  readonly totalCardsMissing: number | null;
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

export const DECKS_QUERY_KEY = ['decks'] as const;

export function useDecksQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: DECKS_QUERY_KEY,
    queryFn: () => apiFetch<ITrackedDeckListResponse>('/decks'),
  });
}

/**
 * Imports a Fabrary deck and starts tracking it.
 *
 * `seedInventory` defaults to `false`: tracking a deck does NOT assume the
 * user owns its cards. Callers that want to seed the user's collection
 * with the deck's cards (e.g. a Library "track + own" path) must opt in
 * explicitly with `seedInventory: true`.
 */
export function useImportDecksMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ urls, seedInventory = false }: { urls: string[]; seedInventory?: boolean }) =>
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

// ---------------------------------------------------------------------------
// v2 Mutations
// ---------------------------------------------------------------------------

/**
 * Patches deck metadata via PATCH /api/decks/:deckId.
 * Accepts partial updates: status, name, addTagIds, removeTagIds.
 *
 * Invalidations on success:
 * - DECKS_QUERY_KEY — home list reflects name/status/tag changes.
 * - deckDetailQueryKey(deckId) — detail view refreshes.
 * - TAGS_QUERY_KEY — implicit tag deletion via removeTagIds can affect the
 *   tag list (U4 may orphan and prune unused tags in future follow-up; we
 *   invalidate defensively so the combobox stays consistent).
 */
export function usePatchDeckMutation(deckId: number) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: IPatchDeckBody) =>
      apiFetch<void>(`/decks/${deckId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['deck-detail', String(deckId)] });
      void queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY });
    },
  });
}

/**
 * Replaces deck composition via PUT /api/decks/:deckId.
 * Transactional: sends the full card list, heroIdentifier, and format.
 * The server computes legality + readiness in-memory and returns them.
 *
 * Invalidations on success:
 * - DECKS_QUERY_KEY — list home stats (missing count, readiness) change.
 * - deckDetailQueryKey(deckId) — full detail refreshes with new snapshot.
 * - LIBRARY_QUERY_KEY — owned/missing counts change when composition shifts.
 *
 * Error contract:
 * - 5xx from PUT: the mutation surfaces the error via mutation.error.
 *   The hook does NOT touch localStorage — draft persistence is U13's concern.
 */
export function usePutDeckMutation(deckId: number) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: IPutDeckBody) =>
      apiFetch<IPutDeckResponse>(`/decks/${deckId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['deck-detail', String(deckId)] });
      void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
    },
  });
}

/**
 * Creates a scratch deck via POST /api/decks.
 * Returns the new deck so the caller can navigate to the edit view:
 *   navigate({ to: '/decks/$deckId', params: { deckId: String(deck.id) },
 *              search: { edit: '1' } })
 *
 * Invalidations on success:
 * - DECKS_QUERY_KEY — home list gains the new deck.
 */
export function useCreateScratchDeckMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ICreateScratchDeckBody) =>
      apiFetch<ICreateScratchDeckResponse>('/decks', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DECKS_QUERY_KEY });
    },
  });
}
