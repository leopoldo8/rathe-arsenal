import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { IShoppingLineResponse } from './shopping-line';

export interface IBreakdownEntry {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly slot: string;
  /**
   * Card pitch (1 = red, 2 = yellow, 3 = blue).
   * null for pitch-less cards (heroes, weapons, equipment). Added in U11.
   */
  readonly pitch: 1 | 2 | 3 | null;
  /**
   * Card cost in resources. null for pitch-less cards. Added in U11.
   */
  readonly cost: number | null;
  /**
   * Primary card type from catalog (types[0]). 'unknown' as fallback. Added in U11.
   * Used by CardArt for the type glyph (R47).
   */
  readonly type: string;
  /**
   * Public URLs for the card face image (WebP), small + large, served
   * from the LSS public S3 bucket. null when the source card has no
   * image code. CardArt falls back to the SVG placeholder on load
   * failure or missing URL.
   */
  readonly imageUrl:
    | {
        readonly small: string;
        readonly large: string;
        readonly sources: readonly { readonly small: string; readonly large: string }[];
      }
    | null;
}

export interface ISubstituteCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly classes: readonly string[];
  readonly pitch: number | null;
  readonly power: number | null;
  readonly defense: number | null;
  readonly keywords: readonly string[];
  /** Same shape as IBreakdownEntry.imageUrl; null when unavailable. */
  readonly imageUrl:
    | {
        readonly small: string;
        readonly large: string;
        readonly sources: readonly { readonly small: string; readonly large: string }[];
      }
    | null;
}

export interface ISubstitutionMatch {
  readonly substitute: ISubstituteCard;
  readonly tier: number;
  readonly score: number;
  readonly rationale: string;
}

export interface ISubstitutedEntry {
  readonly original: IBreakdownEntry;
  readonly match: ISubstitutionMatch;
}

export interface IBreakdown {
  readonly exact: readonly IBreakdownEntry[];
  readonly substituted: readonly ISubstitutedEntry[];
  readonly missing: readonly IBreakdownEntry[];
  /**
   * All cards the user does not fully own: union of `missing` + originals
   * from `substituted`. Source of truth for the "I own this" affordance.
   */
  readonly notOwned: readonly IBreakdownEntry[];
}

/**
 * Path classification for a readiness snapshot.
 *
 * - **A**: 100% exact coverage.
 * - **B**: missing cards covered by tier 1 or tier 2 substitutions
 *          (effectivePercent = 100).
 * - **C**: some cards remain missing after substitution attempts.
 */
export type TPath = 'A' | 'B' | 'C';

export interface IDeckDetailSnapshot {
  readonly id: number;
  readonly rawPercent: number;
  readonly effectivePercent: number;
  readonly path: TPath;
  /**
   * Tier-weighted fidelity score (0-100). Not pre-rounded; format for
   * display with `Math.round(fidelityPercent * 10) / 10` or equivalent.
   */
  readonly fidelityPercent: number;
  readonly breakdown: IBreakdown;
  readonly computedAt: string;
}

/**
 * Per-card substitution decision included in the deck detail response.
 * Only non-pending decisions appear here — absence implies pending.
 * Required for Unit 17 optimistic-update snapshot splicing.
 */
export interface IDecisionEntry {
  readonly cardIdentifier: string;
  readonly decision: 'approved' | 'rejected';
}

export interface IDeckDetailResponse {
  readonly id: number;
  readonly fabraryUlid: string;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly trackedAt: string;
  readonly totalCards: number;
  readonly latestSnapshot: IDeckDetailSnapshot | null;
  /**
   * Count of decision='rejected' rows for this deck (U9).
   * Renamed from rejectionCount to align with the 3-state model.
   * The deck detail page renders a modified-view banner when > 0.
   */
  readonly rejectedCount: number;
  /** Count of decision='approved' rows for this deck (U9). */
  readonly approvedCount: number;
  /** Count of non-owned cards without an explicit decision (U9). */
  readonly pendingCount: number;
  /**
   * All non-pending decisions for this deck (U9).
   * Required by Unit 17's optimistic-update snapshot path.
   */
  readonly decisions: readonly IDecisionEntry[];
  /** Shopping line data for this deck. Added in Phase 1b Unit 5. */
  readonly shoppingLine?: IShoppingLineResponse;
}

export interface IMarkOwnedResponse {
  readonly cardIdentifier: string;
  readonly newQuantity: number;
  readonly snapshot: IDeckDetailSnapshot;
}

const DECK_DETAIL_KEY = 'deck-detail' as const;

/** Polling interval when a variant fetch is active, in milliseconds. */
const VARIANT_FETCH_POLL_INTERVAL_MS = 3_000;

/** Hard safety timeout for polling, in milliseconds (5 minutes). */
export const VARIANT_FETCH_POLL_TIMEOUT_MS = 5 * 60 * 1_000;

export function deckDetailQueryKey(deckId: string): readonly [string, string] {
  return [DECK_DETAIL_KEY, deckId] as const;
}

/**
 * Compute the `refetchInterval` for the deck-detail query.
 *
 * Returns the polling interval (3 s) when a variant fetch is active, or
 * `false` to disable polling when any stop condition is met:
 *
 *  1. `variantFetchProgress` is absent/undefined — explicit stop. This
 *     covers both "never started" and "pod restarted mid-fetch" (the
 *     backend's in-memory tracker is lost on restart; the field will simply
 *     be absent on the next poll response). CRITICAL: do not rely solely on
 *     `inProgress === false`; absent progress is an equally valid stop signal.
 *  2. `variantFetchProgress.inProgress === false` — fetch completed.
 *  3. `isEstimated === false` — all cards now have variant data; no more
 *     polling needed even if the progress entry is still in memory.
 *  4. `pollingStartedAt` is defined and the 5-minute safety timeout has
 *     elapsed — prevents runaway polling if the backend never signals done.
 */
export function computeVariantFetchInterval(
  data: IDeckDetailResponse | undefined,
  pollingStartedAt: number | undefined,
): number | false {
  const shoppingLine = data?.shoppingLine;
  if (!shoppingLine || shoppingLine.kind !== 'populated') return false;

  const { variantFetchProgress, isEstimated } = shoppingLine;

  // Stop condition 1: no progress entry present (pod restart or never started)
  if (!variantFetchProgress) return false;

  // Stop condition 2: backend signalled completion
  if (!variantFetchProgress.inProgress) return false;

  // Stop condition 3: all cards have variant data
  if (isEstimated === false) return false;

  // Stop condition 4: 5-minute hard safety timeout
  if (
    pollingStartedAt !== undefined &&
    Date.now() - pollingStartedAt >= VARIANT_FETCH_POLL_TIMEOUT_MS
  ) {
    return false;
  }

  return VARIANT_FETCH_POLL_INTERVAL_MS;
}

/**
 * Query hook for deck detail data.
 *
 * Accepts an optional `pollingStartedAt` timestamp (epoch ms). When
 * provided, the hook enables dynamic polling during an active variant
 * fetch, stopping automatically when any of the 4 stop conditions are met.
 * Pass `undefined` (default) to disable polling entirely.
 */
export function useDeckDetailQuery(
  deckId: string,
  pollingStartedAt?: number | undefined,
) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: deckDetailQueryKey(deckId),
    queryFn: () => apiFetch<IDeckDetailResponse>(`/decks/${deckId}`),
    refetchInterval: (query) =>
      computeVariantFetchInterval(query.state.data, pollingStartedAt),
  });
}

export function useMarkOwnedMutation(deckId: string) {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardIdentifier: string) =>
      apiFetch<IMarkOwnedResponse>('/collection/mark-owned', {
        method: 'POST',
        body: JSON.stringify({ deckId: Number(deckId), cardIdentifier }),
      }),
    onSuccess: () => {
      // Invalidate both detail and list queries to refetch with fresh data
      void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(deckId) });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}
