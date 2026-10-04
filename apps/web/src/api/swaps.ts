import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { ApiError, useApiClient } from '../lib/api-client';
import { BULK_MAX_ROWS, runBulk } from '../components/swaps/swap-bulk';
import { deckDetailQueryKey } from './deck-detail';

export type TSwapStatus = 'pending' | 'approved' | 'rejected' | 'retired';
export type TSwapTab = 'pending' | 'approved' | 'rejected';
export type TSwapOutcome = 'worked' | 'did_not_work';

export const SWAP_REJECTION_REASONS = [
  'not_equivalent',
  'dont_own',
  'changes_plan',
  'prefer_original',
  'other',
] as const;

export type TSwapRejectionReason = (typeof SWAP_REJECTION_REASONS)[number];

export interface ISwapImageUrl {
  readonly small: string;
  readonly large: string;
  readonly sources: readonly { readonly small: string; readonly large: string }[];
}

export interface IRationaleDetail {
  readonly tier: number;
  readonly pitch: string;
  readonly sharedClasses: readonly string[];
  readonly powerDelta: number;
  readonly defenseDelta: number;
  readonly sharedKeywords: readonly string[];
}

export interface ISwapRow {
  readonly id: string;
  readonly trackedDeckId: number;
  readonly deckName: string;
  readonly hero: string;
  readonly cardIdentifier: string;
  readonly originalName: string;
  readonly slot: string;
  readonly substituteIdentifier: string;
  readonly substituteName: string;
  readonly quantity: number;
  readonly ownedCount: number;
  readonly tier: 1 | 2;
  readonly confidence: number;
  readonly rationale: string;
  /** The facts behind `rationale`; null when a card left the catalog. */
  readonly rationaleDetail?: IRationaleDetail | null;
  readonly status: TSwapStatus;
  readonly appliedAt: string | null;
  readonly rejectedAt: string | null;
  readonly rejectionReason: TSwapRejectionReason | null;
  readonly rejectionNote: string | null;
  readonly outcome: TSwapOutcome | null;
  readonly originalImageUrl: ISwapImageUrl | null;
  readonly substituteImageUrl: ISwapImageUrl | null;
  readonly originalPitch: 1 | 2 | 3 | null;
  readonly substitutePitch: 1 | 2 | 3 | null;
  readonly originalType: string;
  readonly substituteType: string;
}

export interface ISwapsResponse {
  readonly rows: readonly ISwapRow[];
}

export interface ISwapMutationResult {
  readonly deckId: number;
  readonly swap: ISwapRow;
  readonly rows: readonly ISwapRow[];
}

export type TSwapAction =
  | { readonly kind: 'approve' }
  | { readonly kind: 'revert' }
  | { readonly kind: 'restore' }
  | {
      readonly kind: 'reject';
      readonly reason?: TSwapRejectionReason | undefined;
      readonly note?: string | undefined;
    }
  | { readonly kind: 'outcome'; readonly outcome: TSwapOutcome };

export interface ISwapMutationVariables {
  readonly swapId: string;
  readonly action: TSwapAction;
}

export const SWAPS_QUERY_KEY = ['swaps'] as const;

export function useSwapsQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: SWAPS_QUERY_KEY,
    queryFn: () => apiFetch<ISwapsResponse>('/swaps?state=all'),
  });
}

export function selectDeckSwaps(
  rows: readonly ISwapRow[] | undefined,
  trackedDeckId: number,
): readonly ISwapRow[] {
  return (rows ?? []).filter((row) => row.trackedDeckId === trackedDeckId);
}

export interface ISwapMatchKey {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly substituteIdentifier: string;
}

export function findSwap<T extends ISwapMatchKey>(
  rows: readonly T[],
  key: ISwapMatchKey,
): T | undefined {
  return rows.find(
    (row) =>
      row.cardIdentifier === key.cardIdentifier &&
      row.slot === key.slot &&
      row.substituteIdentifier === key.substituteIdentifier,
  );
}

/**
 * Swaps one deck's rows for the server's fresh copy while every other deck
 * keeps its position, so a row never jumps in a list the user is reading.
 */
export function replaceDeckSlice(
  current: readonly ISwapRow[],
  deckId: number,
  fresh: readonly ISwapRow[],
): readonly ISwapRow[] {
  const freshById = new Map(fresh.map((row) => [row.id, row]));
  const placed = new Set<string>();
  const next: ISwapRow[] = [];

  for (const row of current) {
    if (row.trackedDeckId !== deckId) {
      next.push(row);
      continue;
    }
    const replacement = freshById.get(row.id);
    if (replacement) {
      next.push(replacement);
      placed.add(row.id);
    }
  }
  for (const row of fresh) {
    if (!placed.has(row.id)) next.push(row);
  }
  return next;
}

function actionRequest(action: TSwapAction): { readonly path: string; readonly body?: string } {
  switch (action.kind) {
    case 'reject': {
      const payload: { reason?: TSwapRejectionReason; note?: string } = {};
      if (action.reason) payload.reason = action.reason;
      if (action.note) payload.note = action.note;
      return { path: 'reject', body: JSON.stringify(payload) };
    }
    case 'outcome':
      return { path: 'outcome', body: JSON.stringify({ outcome: action.outcome }) };
    default:
      return { path: action.kind };
  }
}

export function isInvalidTransition(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.message.includes('INVALID_TRANSITION');
}

function invalidateReadiness(queryClient: QueryClient, deckId: number): void {
  void queryClient.invalidateQueries({ queryKey: ['decks'] });
  void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(String(deckId)) });
}

function useSwapRequest(): (variables: ISwapMutationVariables) => Promise<ISwapMutationResult> {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();

  return async ({ swapId, action }) => {
    const { path, body } = actionRequest(action);
    try {
      const result = await apiFetch<ISwapMutationResult>(`/swaps/${swapId}/${path}`, {
        method: 'POST',
        ...(body !== undefined ? { body } : {}),
      });
      queryClient.setQueryData<ISwapsResponse>(SWAPS_QUERY_KEY, (previous) =>
        previous
          ? { rows: replaceDeckSlice(previous.rows, result.deckId, result.rows) }
          : { rows: result.rows },
      );
      return result;
    } catch (error) {
      // 409 and 404 mean the cached row is stale, so resync the whole list.
      if (isInvalidTransition(error) || (error instanceof ApiError && error.status === 404)) {
        void queryClient.invalidateQueries({ queryKey: SWAPS_QUERY_KEY });
      }
      throw error;
    }
  };
}

/**
 * Calls one of the five single-swap endpoints and folds the response into the
 * cached cross-deck list by replacing only that deck's slice.
 */
export function useSwapMutation() {
  const request = useSwapRequest();
  const queryClient = useQueryClient();
  return useMutation<ISwapMutationResult, Error, ISwapMutationVariables>({
    mutationFn: request,
    onSuccess: (result) => invalidateReadiness(queryClient, result.deckId),
  });
}

export interface ISwapBatch {
  readonly perform: (variables: ISwapMutationVariables) => Promise<ISwapMutationResult>;
  readonly finish: () => void;
}

/**
 * For a run of calls in a row: readiness queries are refreshed once, in
 * `finish`, instead of once per call, so a bulk action does not refetch the
 * deck pages dozens of times.
 */
export function useSwapBatch(): ISwapBatch {
  const request = useSwapRequest();
  const queryClient = useQueryClient();
  const touchedDeckIds = useRef(new Set<number>());

  return {
    perform: async (variables) => {
      const result = await request(variables);
      touchedDeckIds.current.add(result.deckId);
      return result;
    },
    finish: () => {
      for (const deckId of touchedDeckIds.current) invalidateReadiness(queryClient, deckId);
      touchedDeckIds.current = new Set<number>();
    },
  };
}

export interface IRestoreRejectedResult {
  readonly restored: number;
  readonly failed: number;
  readonly attempted: number;
  readonly remaining: number;
}

/**
 * Sends rejected swaps back to pending through the same sequential, capped
 * run as the Swaps bulk bar; rows beyond the cap are reported as `remaining`.
 */
export function useRestoreRejectedSwaps() {
  const batch = useSwapBatch();
  return useMutation<IRestoreRejectedResult, Error, readonly ISwapRow[]>({
    mutationFn: async (rows) => {
      const run = rows.slice(0, BULK_MAX_ROWS);
      const result = await runBulk(run, 'reset', (swapId, action) =>
        batch.perform({ swapId, action }),
      );
      batch.finish();
      return {
        restored: result.succeeded,
        failed: result.failedIds.length,
        attempted: result.total - result.skipped,
        remaining: rows.length - run.length,
      };
    },
  });
}
