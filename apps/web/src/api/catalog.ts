import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

export interface ISearchCardResult {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly classes: readonly string[];
  readonly types: readonly string[];
  readonly ownedQuantity: number;
  /**
   * Card face image URLs (small + large WebP). Null when the source
   * catalog entry has no image code. Frontend renders `small` as a 52x72
   * row thumbnail; click opens `large` in the shared CardLightbox.
   */
  readonly imageUrl: { readonly small: string; readonly large: string } | null;
  /**
   * Legality fields from U17 — extended `/catalog/search` response.
   * Formats in which this card is legal (e.g. ["CC", "Blitz"]).
   */
  readonly legalFormats: readonly string[];
  /**
   * Hero identifiers (cardIdentifier) for which this card is legal.
   * Empty array means no hero restriction (legal for all heroes in the
   * legal formats).
   */
  readonly legalHeroes: readonly string[];
  /**
   * Formats in which this card is explicitly banned. Empty array = no bans.
   */
  readonly bannedFormats: readonly string[];
}

export interface ISearchCardsResponse {
  readonly results: readonly ISearchCardResult[];
}

// ---------------------------------------------------------------------------
// Heroes endpoint — GET /catalog/heroes
// ---------------------------------------------------------------------------

/**
 * Slim hero descriptor from GET /catalog/heroes.
 * Used to populate the HeroDropdown in the Edit-mode composition panel.
 * The web app must not bundle the engine to derive this list — it comes
 * exclusively from the API (per U7 KTD: no engine import in web).
 */
export interface IHeroListItem {
  readonly cardIdentifier: string;
  readonly name: string;
  /** True when this is the young (non-adult) version of the hero. */
  readonly young: boolean;
  /** Formats in which this hero is legal (e.g. ["CC", "Blitz"]). */
  readonly legalFormats: readonly string[];
  /**
   * Card face image with fallback `sources` list. CardArt and CardLightbox
   * cycle through `sources` on `<img>` `onError` so heroes that only ship
   * foiled or alternate-art variants still render. Null when the source
   * catalog entry has no image code.
   */
  readonly imageUrl: {
    readonly small: string;
    readonly large: string;
    readonly sources: readonly { readonly small: string; readonly large: string }[];
  } | null;
}

export interface IHeroListResponse {
  readonly heroes: readonly IHeroListItem[];
}

export const HEROES_QUERY_KEY = ['catalog-heroes'] as const;

export const CATALOG_SEARCH_QUERY_KEY = ['catalog', 'search'] as const;

const DEFAULT_LIMIT = 10;
const MIN_QUERY_LENGTH = 2;

/**
 * Fetches the list of all heroes from GET /catalog/heroes.
 *
 * The hero set changes only on engine/catalog updates (rare), so we cache
 * indefinitely for the session (staleTime: Infinity). Invalidation is not
 * wired to any mutation — if the hero catalog changes, a page reload suffices.
 *
 * The web app MUST use this endpoint instead of importing the engine package
 * to derive heroes — engine bundle size is unacceptable in the web bundle.
 */
export function useHeroesQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: HEROES_QUERY_KEY,
    queryFn: () => apiFetch<IHeroListResponse>('/catalog/heroes'),
    staleTime: Infinity,
  });
}

/**
 * Fetches autocomplete results for a card-name search. The hook is guarded
 * by `enabled: query.length >= 2` so the API is never called with queries
 * that would be rejected at the DTO layer.
 */
export function useSearchCardsQuery(query: string, limit: number = DEFAULT_LIMIT) {
  const apiFetch = useApiClient();
  const trimmed = query.trim();
  return useQuery({
    queryKey: [...CATALOG_SEARCH_QUERY_KEY, trimmed, limit] as const,
    queryFn: () =>
      apiFetch<ISearchCardsResponse>(
        `/catalog/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`,
      ),
    enabled: trimmed.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  });
}
