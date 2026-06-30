import { useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from '../i18n';
import { useApiClient } from '../lib/api-client';
import { deckDetailQueryKey, IDeckDetailResponse } from './deck-detail';
import { IToastPayload } from '../components/ui/Toast/ToastProvider';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface IDecision {
  readonly cardIdentifier: string;
  readonly decision: 'approved' | 'rejected';
}

export interface IUpsertDecisionBody {
  readonly cardIdentifier: string;
  readonly decision: 'approved' | 'rejected';
}

export interface IClearRejectionsResponse {
  readonly cleared: number;
}

/**
 * Callback type matching the `show` function from `useToast`.
 * Passed into mutation hooks by callers that want rollback-error toasts.
 */
export type TShowToast = (payload: IToastPayload) => void;

// ---------------------------------------------------------------------------
// Optimistic update helpers
// ---------------------------------------------------------------------------

/**
 * Apply an optimistic upsert of a decision into the cached deck-detail data.
 *
 * Returns a new IDeckDetailResponse with the `decisions` array updated:
 *   - Adds a new entry if none exists for `cardIdentifier`.
 *   - Replaces the existing entry if one already exists.
 *   - Also updates the derived counts (`approvedCount`, `rejectedCount`,
 *     `pendingCount`) to match the new decisions state.
 */
function applyOptimisticUpsert(
  prev: IDeckDetailResponse,
  cardIdentifier: string,
  decision: 'approved' | 'rejected',
): IDeckDetailResponse {
  const existing = prev.decisions.find((d) => d.cardIdentifier === cardIdentifier);

  const updatedDecisions = existing
    ? prev.decisions.map((d) =>
        d.cardIdentifier === cardIdentifier ? { ...d, decision } : d,
      )
    : [...prev.decisions, { cardIdentifier, decision }];

  // Recompute derived counts based on the updated decisions list.
  const approvedCount = updatedDecisions.filter((d) => d.decision === 'approved').length;
  const rejectedCount = updatedDecisions.filter((d) => d.decision === 'rejected').length;

  // pendingCount = total not-owned cards minus cards with an explicit decision.
  // The original pendingCount + approvedCount + rejectedCount = total not-owned.
  const totalNotOwned = prev.pendingCount + prev.approvedCount + prev.rejectedCount;
  const pendingCount = totalNotOwned - approvedCount - rejectedCount;

  return {
    ...prev,
    decisions: updatedDecisions,
    approvedCount,
    rejectedCount,
    pendingCount,
  };
}

/**
 * Apply an optimistic reset (delete) of a decision from the cached deck-detail data.
 *
 * Returns a new IDeckDetailResponse with the matching decision entry removed,
 * and derived counts updated accordingly.
 */
function applyOptimisticReset(
  prev: IDeckDetailResponse,
  cardIdentifier: string,
): IDeckDetailResponse {
  const existing = prev.decisions.find((d) => d.cardIdentifier === cardIdentifier);
  if (!existing) return prev; // Nothing to remove — already pending.

  const updatedDecisions = prev.decisions.filter(
    (d) => d.cardIdentifier !== cardIdentifier,
  );

  const wasApproved = existing.decision === 'approved';
  const approvedCount = wasApproved ? prev.approvedCount - 1 : prev.approvedCount;
  const rejectedCount = wasApproved ? prev.rejectedCount : prev.rejectedCount - 1;
  const pendingCount = prev.pendingCount + 1;

  return {
    ...prev,
    decisions: updatedDecisions,
    approvedCount,
    rejectedCount,
    pendingCount,
  };
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Options accepted by optimistic mutation hooks.
 */
interface IOptimisticMutationOptions {
  /**
   * Called on mutation failure after rollback. Pass `useToast().show` here
   * to wire the burst-consolidation error toast (R59, R61).
   * When omitted, errors are silently rolled back with no toast.
   */
  readonly showToast?: TShowToast;
}

/**
 * Context saved by onMutate for rollback in onError.
 */
interface IMutationContext {
  readonly previous: IDeckDetailResponse | undefined;
}

/**
 * Upsert a substitution decision (approve or reject) for a card in a tracked
 * deck.
 *
 * Implements optimistic-with-rollback (R61):
 *   - `onMutate`: cancels in-flight queries, snapshots current data, applies
 *     the optimistic update immediately so the UI responds without waiting for
 *     the server.
 *   - `onError`: restores the snapshot (rollback) and queues an error toast
 *     through the caller-supplied `showToast` (burst-consolidated via Unit 4's
 *     ToastProvider when >=2 failures arrive within 500ms — R59).
 *   - `onSuccess`: dual-invalidates `['decks']` + `['deck-detail', deckId]` so
 *     home shelves and deck detail refetch with authoritative server state.
 *
 * KNOWN LIMITATION — Polling-vs-mutation flicker:
 *   When `useDeckDetailQuery` is actively polling (variant-fetch mode, every
 *   3 s), a refetch can arrive between `onMutate` (optimistic write) and
 *   `onSuccess` (invalidation refetch), briefly replacing the optimistic state
 *   with the pre-mutation server state. `cancelQueries` in `onMutate` mitigates
 *   this for in-flight requests, but a poll that was delayed (e.g., scheduled
 *   just before `cancelQueries` ran) can still win the race. Mitigation in a
 *   future unit: set `enabled: false` on the poll when any decision mutation is
 *   pending. Tracked as a known Plan A limitation; Gate 2 testers should
 *   observe the flicker only when DevTools shows the "Fetch variants" poll is
 *   active simultaneously with an approve/reject action.
 */
export function useDecideSubstitutionMutation(
  deckId: string,
  { showToast }: IOptimisticMutationOptions = {},
) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  const queryKey = deckDetailQueryKey(deckId);

  return useMutation<IDecision, Error, IUpsertDecisionBody, IMutationContext>({
    mutationFn: (body) =>
      apiFetch<IDecision>(`/decks/${deckId}/decisions`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    onMutate: async (variables) => {
      // Cancel any in-flight refetches so they do not overwrite our optimistic update.
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the current cached data as our rollback point.
      const previous = queryClient.getQueryData<IDeckDetailResponse>(queryKey);

      // Apply the optimistic update immediately.
      if (previous !== undefined) {
        queryClient.setQueryData<IDeckDetailResponse>(
          queryKey,
          applyOptimisticUpsert(previous, variables.cardIdentifier, variables.decision),
        );
      }

      return { previous };
    },

    onError: (_err, variables, context) => {
      // Rollback to the pre-mutation snapshot.
      if (context?.previous !== undefined) {
        queryClient.setQueryData<IDeckDetailResponse>(queryKey, context.previous);
      }

      // Queue an error toast (burst-consolidated by ToastProvider when >= 2
      // failures arrive within 500ms — R59 burst-consolidation contract).
      showToast?.({
        kind: 'error',
        message: i18n.t('decks.failedDecideSubstitution', { decision: variables.decision }),
        retry: () => {
          // Re-fire the same mutation so "Retry all" wires back through onMutate.
          // The query client reference is stable; re-invoke via mutation.
          void apiFetch<IDecision>(`/decks/${deckId}/decisions`, {
            method: 'POST',
            body: JSON.stringify(variables),
          }).then(() => {
            void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(deckId) });
            void queryClient.invalidateQueries({ queryKey: ['decks'] });
          });
        },
      });
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(deckId) });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

/**
 * Reset a single card's decision back to pending (deletes the row).
 *
 * Implements optimistic-with-rollback (R61):
 *   - `onMutate`: cancels in-flight queries, snapshots, removes the decision
 *     entry optimistically.
 *   - `onError`: rollback + optional error toast via `showToast`.
 *   - `onSuccess`: dual-invalidates `['decks']` + `['deck-detail', deckId]`.
 */
export function useResetDecisionsMutation(
  deckId: string,
  { showToast }: IOptimisticMutationOptions = {},
) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  const queryKey = deckDetailQueryKey(deckId);

  return useMutation<void, Error, string, IMutationContext>({
    mutationFn: (cardIdentifier) =>
      apiFetch<void>(
        `/decks/${deckId}/decisions/${encodeURIComponent(cardIdentifier)}`,
        { method: 'DELETE' },
      ),

    onMutate: async (cardIdentifier) => {
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<IDeckDetailResponse>(queryKey);

      if (previous !== undefined) {
        queryClient.setQueryData<IDeckDetailResponse>(
          queryKey,
          applyOptimisticReset(previous, cardIdentifier),
        );
      }

      return { previous };
    },

    onError: (_err, _cardIdentifier, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<IDeckDetailResponse>(queryKey, context.previous);
      }

      showToast?.({
        kind: 'error',
        message: i18n.t('decks.failedResetDecision'),
      });
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(deckId) });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

/**
 * Bulk-clear all rejections for a deck (preserves approvals).
 * Powers the "Clear rejections" banner action (Unit 16).
 * Dual-invalidates both the deck list and deck detail queries on success.
 *
 * Note: this mutation does not implement optimistic update because the
 * per-card breakdown required to recompute the deck-detail state is not
 * available without a server round-trip. Invalidation on success is sufficient
 * for the banner disappear UX.
 */
export function useClearDeckRejectionsMutation(deckId: string) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<IClearRejectionsResponse>(`/decks/${deckId}/decisions?scope=rejections`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: deckDetailQueryKey(deckId),
      });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}
