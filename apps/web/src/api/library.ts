import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

// ---------------------------------------------------------------------------
// Types — mirrors apps/api/src/collection/library/dtos/library-response.dto.ts
// ---------------------------------------------------------------------------

export interface ILibraryCard {
  readonly cardIdentifier: string;
  readonly name: string;
  /** Pitch value (1=red, 2=yellow, 3=blue) or null for equipment/weapons/etc. */
  readonly pitch: number | null;
  readonly types: readonly string[];
  readonly classes: readonly string[];
  /** Short set-code identifiers (e.g. ["WTR", "CRU"]). */
  readonly sets: readonly string[];
  readonly imageUrl: { readonly small: string; readonly large: string } | null;
  /** Summed quantity owned across all active sources. */
  readonly ownedQuantity: number;
}

export interface IPitchBreakdown {
  readonly red: number;
  readonly yellow: number;
  readonly blue: number;
  readonly colorless: number;
}

export interface ILibraryStats {
  readonly uniqueCount: number;
  readonly totalCopies: number;
  readonly pitchBreakdown: IPitchBreakdown;
  readonly estimatedValueCents: number;
  readonly pricedIdentifierCount: number;
  readonly priceDataLastUpdatedAt: string | null;
}

export interface ILibraryResponse {
  readonly cards: readonly ILibraryCard[];
  readonly stats: ILibraryStats;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export const LIBRARY_QUERY_KEY = ['library'] as const;

/**
 * Fetches the authenticated user's full library view from
 * GET /api/collection/library. The result is a flat list of all cards the
 * user owns (merged across all active CSV sources) with aggregate stats.
 *
 * Stale time is set to 30 s so navigating away and back does not trigger
 * an immediate refetch, while invalidation from useAddCardMutation will
 * still trigger a background refresh.
 */
export function useLibraryQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: LIBRARY_QUERY_KEY,
    queryFn: () => apiFetch<ILibraryResponse>('/collection/library'),
    staleTime: 30_000,
  });
}
