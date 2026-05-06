import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { deckDetailQueryKey } from './deck-detail';

// ---------------------------------------------------------------------------
// Types — mirroring the backend IBulkUpsertResult shape
// ---------------------------------------------------------------------------

export type TReviewDecision = 'APPROVED' | 'REJECTED';
export type TReviewState = 'pending' | 'approved' | 'rejected';

// Renamed aliases (new preferred names)
export type TSwapDecision = TReviewDecision;
export type TSwapState = TReviewState;

/**
 * A single row returned by `GET /api/reviews` — represents one substitution
 * across a user's tracked decks that may require a review decision.
 */
export interface IReviewRow {
  readonly trackedDeckId: number;
  readonly deckName: string;
  readonly hero: string;
  readonly cardIdentifier: string;
  /** Human-readable name for the original card. Falls back to identifier. */
  readonly originalName: string;
  readonly substituteIdentifier: string;
  readonly substituteName: string;
  readonly tier: 1 | 2 | 3;
  /** Confidence score 0–100. */
  readonly confidence: number;
  readonly rationale: string;
  readonly decision: TReviewState;
  readonly originalImageUrl: { readonly small: string; readonly large: string } | null;
  readonly substituteImageUrl: { readonly small: string; readonly large: string } | null;
  readonly originalPitch: 1 | 2 | 3 | null;
  readonly substitutePitch: 1 | 2 | 3 | null;
  readonly originalType: string;
  readonly substituteType: string;
}

// Renamed alias (new preferred name)
export type ISwapRow = IReviewRow;

export interface IReviewsResponse {
  readonly rows: readonly IReviewRow[];
}

/** Unique composite key for a review row — trackedDeckId + cardIdentifier. */
export type TReviewRowId = `${number}:${string}`;

export function makeReviewRowId(trackedDeckId: number, cardIdentifier: string): TReviewRowId {
  return `${trackedDeckId}:${cardIdentifier}`;
}

// ---------------------------------------------------------------------------
// Bulk operation types
// ---------------------------------------------------------------------------

export interface IBulkOperation {
  readonly trackedDeckId: number;
  readonly cardIdentifier: string;
  readonly decision?: TReviewDecision;
  readonly reset?: true;
}

export interface IBulkReviewFailure {
  readonly trackedDeckId: string;
  readonly cardIdentifier: string;
  readonly error: 'NOT_ACCESSIBLE' | 'INVALID_SHAPE';
}

export interface IBulkUpsertResult {
  readonly succeeded: number;
  readonly failed: readonly IBulkReviewFailure[];
  readonly transactionError?: {
    readonly code: string;
    readonly cursorHint?: number;
  };
}

// ---------------------------------------------------------------------------
// Query key
// ---------------------------------------------------------------------------

export const REVIEWS_QUERY_KEY = ['reviews'] as const;

// ---------------------------------------------------------------------------
// Query hook
// ---------------------------------------------------------------------------

/**
 * Fetches all swap/review rows for the current user from `GET /api/reviews?state=all`.
 *
 * Requests ALL state rows (pending + approved + rejected) so that client-side
 * tab filtering works correctly. Without `?state=all`, the backend defaults to
 * `state=pending`, which causes approved/rejected rows to disappear from their
 * tabs after a decision is made and the query refetches.
 *
 * The response contains rows across all tracked decks. Client-side filtering
 * by `state`, `tier`, `deck`, `hero`, and `confidence` is performed in the
 * consuming components — this keeps the hook simple and avoids re-fetching
 * on every filter change.
 */
export function useReviewsQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: REVIEWS_QUERY_KEY,
    queryFn: () => apiFetch<IReviewsResponse>('/reviews?state=all'),
  });
}

// Renamed alias (new preferred name)
export const useSwapsQuery = useReviewsQuery;

// ---------------------------------------------------------------------------
// Bulk mutation hook
// ---------------------------------------------------------------------------

/**
 * Applies up to 200 swap/review operations atomically via `POST /api/reviews/bulk`.
 *
 * Used for BOTH single-row and bulk actions — unified code path per spec.
 *
 * Success: invalidates `['reviews']`, `['decks']`, and all active
 * `['deck-detail', *]` queries so every view reflects the updated decisions.
 * Shows a success toast with the count of state-changing operations.
 *
 * Error (HTTP 4xx/5xx OR HTTP 200 with `transactionError`): shows a single
 * consolidated error toast — "Some changes couldn't be saved — please try
 * again". No Retry button; all-or-nothing semantics already require full
 * resubmission. Triggers a refetch to restore authoritative state.
 *
 * No optimistic update on the Swaps page (per spec). Per-row action buttons
 * are disabled while `bulkMutation.isPending` is true to prevent concurrent
 * stale requests.
 */
export function useBulkReviewsMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<IBulkUpsertResult, Error, IBulkOperation[]>({
    mutationFn: (operations) =>
      apiFetch<IBulkUpsertResult>('/reviews/bulk', {
        method: 'POST',
        body: JSON.stringify({ operations }),
      }),

    onSuccess: () => {
      // Invalidate for authoritative data. Toast is handled by the caller
      // (SwapsPage.handleAction) so it can be tested independently.
      void queryClient.invalidateQueries({ queryKey: REVIEWS_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
      void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'deck-detail' });
    },

    onError: () => {
      // Refetch to restore authoritative state after network/server error.
      // Toast is handled by the caller.
      void queryClient.invalidateQueries({ queryKey: REVIEWS_QUERY_KEY });
    },
  });
}

// Renamed alias (new preferred name)
export const useBulkSwapsMutation = useBulkReviewsMutation;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derives a human-readable action label from the operations array.
 * When all operations share the same action, uses that label. Mixed → "Updated".
 */
export function resolveActionLabel(operations: readonly IBulkOperation[]): string {
  if (operations.length === 0) return 'Updated';

  const firstOp = operations[0];
  if (!firstOp) return 'Updated';

  if (firstOp.reset === true) {
    const allReset = operations.every((op) => op.reset === true);
    return allReset ? 'Reset' : 'Updated';
  }

  if (firstOp.decision === 'APPROVED') {
    const allApprove = operations.every((op) => op.decision === 'APPROVED');
    return allApprove ? 'Approved' : 'Updated';
  }

  if (firstOp.decision === 'REJECTED') {
    const allReject = operations.every((op) => op.decision === 'REJECTED');
    return allReject ? 'Rejected' : 'Updated';
  }

  return 'Updated';
}

/**
 * Builds a success toast message from the action label and succeeded count.
 *
 * Examples:
 *  - "Approved 3 swaps"
 *  - "Approved 0 swaps" (idempotent; already-approved rows show 0)
 *  - "Reset 5 swaps"
 */
export function buildSuccessMessage(actionLabel: string, succeeded: number): string {
  const noun = succeeded === 1 ? 'swap' : 'swaps';
  return `${actionLabel} ${succeeded} ${noun}`;
}

// ---------------------------------------------------------------------------
// Query invalidation helper (used by SwapsPage to invalidate deck-detail)
// ---------------------------------------------------------------------------

export function invalidateDeckDetailQuery(
  queryClient: ReturnType<typeof useQueryClient>,
  deckId: string,
): void {
  void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(deckId) });
}
