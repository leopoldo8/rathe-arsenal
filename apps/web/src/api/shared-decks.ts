import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { AuthFetchError, authFetch } from '../lib/auth-fetch';

// ---------------------------------------------------------------------------
// Types - mirror the sharing API contracts in
// .specs/features/sharing-decks/design.md (ISharedDeckResponse and friends).
// ---------------------------------------------------------------------------

export interface ISharedCardImage {
  readonly small: string;
  readonly large: string;
  readonly sources: readonly { readonly small: string; readonly large: string }[];
}

export interface ISharedCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  readonly type: string;
  /** 'hero' | 'weapon' | 'equipment' | 'mainboard' | ... */
  readonly slot: string;
  readonly quantity: number;
  readonly imageUrl: ISharedCardImage | null;
}

export interface ISharedDeckResponse {
  readonly token: string;
  readonly url: string;
  readonly name: string;
  readonly hero: string;
  readonly heroIdentifier: string | null;
  readonly format: string;
  readonly sharerName: string;
  /** True when the optional visitor is the owner. */
  readonly isOwner: boolean;
  readonly updatedAt: string;
  readonly totalCards: number;
  readonly cards: readonly ISharedCard[];
  /** The owner's not-owned cards, grouped by (cardIdentifier, slot). */
  readonly missing: readonly ISharedCard[];
  readonly missingCount: number;
  /** Owner's WhatsApp number when they chose to show it; no UI reads it yet. */
  readonly contactWhatsapp: string | null;
}

export interface ISharedDeckCoverage {
  readonly ownedCopies: number;
  readonly totalCopies: number;
  readonly percent: number;
}

export interface IDeckShareState {
  readonly url: string | null;
  readonly token: string | null;
  /** Whether the owner shows a contact on the shared page; no UI reads it yet. */
  readonly showContact: boolean;
}

// ---------------------------------------------------------------------------
// Error codes surfaced by the sharing routes
// ---------------------------------------------------------------------------

export const SHARE_LINK_UNAVAILABLE = 'SHARE_LINK_UNAVAILABLE';
export const DISPLAY_NAME_REQUIRED = 'DISPLAY_NAME_REQUIRED';

export function isShareErrorCode(error: unknown, code: string): boolean {
  return error instanceof AuthFetchError && error.code === code;
}

/** A dead link: turned off, deleted, owner deleted or never existed (the API never says which). */
export function isShareLinkUnavailable(error: unknown): boolean {
  return error instanceof AuthFetchError && error.status === 404;
}

// ---------------------------------------------------------------------------
// Plain request functions. `authToken` is the visitor's Bearer token; the
// public shared-deck call works without one and uses it, when present, so the
// API can tell the owner apart from a visitor.
// ---------------------------------------------------------------------------

export function sharedDeckImageDownloadPath(token: string): string {
  return `/api/shared/decks/${encodeURIComponent(token)}/image?download=1`;
}

export function sharedDeckImagePath(token: string): string {
  return `/api/shared/decks/${encodeURIComponent(token)}/image`;
}

export function getSharedDeck(token: string, authToken: string | null = null): Promise<ISharedDeckResponse> {
  return authFetch<ISharedDeckResponse>(`/shared/decks/${encodeURIComponent(token)}`, {}, authToken);
}

export function getCoverage(token: string, authToken: string | null): Promise<ISharedDeckCoverage> {
  return authFetch<ISharedDeckCoverage>(`/shared/decks/${encodeURIComponent(token)}/coverage`, {}, authToken);
}

export function copySharedDeck(token: string, authToken: string | null): Promise<{ deckId: number }> {
  return authFetch<{ deckId: number }>(
    `/shared/decks/${encodeURIComponent(token)}/copy`,
    { method: 'POST', body: JSON.stringify({}) },
    authToken,
  );
}

export function getDeckShare(deckId: number | string, authToken: string | null): Promise<IDeckShareState> {
  return authFetch<IDeckShareState>(`/decks/${deckId}/share`, {}, authToken);
}

export function enableDeckShare(deckId: number | string, authToken: string | null): Promise<IDeckShareState> {
  return authFetch<IDeckShareState>(
    `/decks/${deckId}/share`,
    { method: 'POST', body: JSON.stringify({}) },
    authToken,
  );
}

export function disableDeckShare(deckId: number | string, authToken: string | null): Promise<void> {
  return authFetch<void>(`/decks/${deckId}/share`, { method: 'DELETE' }, authToken);
}

export function patchDisplayName(displayName: string, authToken: string | null): Promise<{ displayName: string }> {
  return authFetch<{ displayName: string }>(
    '/users/me/display-name',
    { method: 'PATCH', body: JSON.stringify({ displayName }) },
    authToken,
  );
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const sharedDeckQueryKey = (token: string, visitorId: string | null) =>
  ['shared-deck', token, visitorId ?? 'anonymous'] as const;
export const sharedCoverageQueryKey = (token: string, visitorId: string | null) =>
  ['shared-deck-coverage', token, visitorId ?? 'anonymous'] as const;
export const deckShareQueryKey = (deckId: number | string) => ['deck-share', String(deckId)] as const;

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Loads the public shared deck. Every successful load records an "open" on the
 * server, so the query must never refetch on its own: no refetch on window
 * focus or remount, and no retry on a 404 (a dead link stays dead). The key
 * carries the visitor so signing in on the page refetches once, as the owner
 * check depends on who is looking; it waits for auth to settle so the first
 * request already carries the right Bearer token.
 */
export function useSharedDeckQuery(token: string) {
  const { token: authToken, user, isLoading } = useAuth();
  return useQuery({
    queryKey: sharedDeckQueryKey(token, user?.id ?? null),
    queryFn: () => getSharedDeck(token, authToken),
    enabled: !isLoading,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error) => !isShareLinkUnavailable(error) && failureCount < 1,
  });
}

/** The logged-in visitor's exact coverage of the shared deck. Not for the owner or anonymous visitors. */
export function useSharedCoverageQuery(token: string, enabled: boolean) {
  const { token: authToken, user } = useAuth();
  return useQuery({
    queryKey: sharedCoverageQueryKey(token, user?.id ?? null),
    queryFn: () => getCoverage(token, authToken),
    enabled: enabled && authToken !== null,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useCopySharedDeckMutation(token: string) {
  const { token: authToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => copySharedDeck(token, authToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

export function useDeckShareQuery(deckId: number | string) {
  const { token: authToken } = useAuth();
  return useQuery({
    queryKey: deckShareQueryKey(deckId),
    queryFn: () => getDeckShare(deckId, authToken),
    staleTime: Infinity,
  });
}

export function useEnableDeckShareMutation(deckId: number | string) {
  const { token: authToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => enableDeckShare(deckId, authToken),
    onSuccess: (state) => {
      queryClient.setQueryData(deckShareQueryKey(deckId), state);
    },
  });
}

export function useDisableDeckShareMutation(deckId: number | string) {
  const { token: authToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disableDeckShare(deckId, authToken),
    onSuccess: () => {
      queryClient.setQueryData<IDeckShareState>(deckShareQueryKey(deckId), { url: null, token: null, showContact: false });
    },
  });
}
