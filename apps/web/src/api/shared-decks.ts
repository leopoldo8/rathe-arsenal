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
  /** Copies carried outside the starting deck (door 3); absent on answers that predate it. */
  readonly inventoryQuantity?: number;
  readonly imageUrl: ISharedCardImage | null;
}

export type TShareIntent = 'deck' | 'missing';

export interface ISharedFormatVerdict {
  readonly category: 'legal' | 'incomplete' | 'illegal' | 'unchecked';
  readonly details: readonly { readonly code: string; readonly params: Readonly<Record<string, string | number | boolean | null | readonly string[]>> }[];
}

export interface ISharedDeckLegality extends ISharedFormatVerdict {
  /** Null when the hero is not in the catalog. */
  readonly heroYoung: boolean | null;
  readonly otherFormats: readonly (ISharedFormatVerdict & { readonly format: string })[];
}

export interface ISharedDeckResponse {
  readonly intent: TShareIntent;
  readonly token: string;
  readonly url: string;
  readonly name: string;
  readonly hero: string;
  readonly heroIdentifier: string | null;
  /** The hero's card, from the deck or, for scratch decks, from the catalog. */
  readonly heroCard: ISharedCard | null;
  readonly format: string;
  readonly sharerName: string;
  /** True when the optional visitor is the owner. */
  readonly isOwner: boolean;
  readonly updatedAt: string;
  readonly totalCards: number;
  /** Intent 'deck': every card. Intent 'missing': empty. */
  readonly cards: readonly ISharedCard[];
  /** Intent 'missing': the owner's not-owned cards, grouped by (cardIdentifier, slot). Intent 'deck': empty. */
  readonly missing: readonly ISharedCard[];
  readonly missingCount: number;
  /** Digits with country code; set only when the owner saved a number and left the link's switch on. */
  readonly contactWhatsapp: string | null;
  /** The deck's id, only for the owner (to link back to the deck); null for everyone else. */
  readonly deckId: number | null;
  /** Intent 'deck': the verdict in the deck's own format and in the others. Intent 'missing': null. */
  readonly legality: ISharedDeckLegality | null;
}

export interface ISharedDeckCoverage {
  readonly ownedCopies: number;
  readonly totalCopies: number;
  readonly percent: number;
  /** True when the visitor owns no copy at all: the panel says how to put cards in instead of showing 0%. */
  readonly collectionEmpty: boolean;
}

export interface ISharedMatches {
  readonly cards: readonly { readonly cardIdentifier: string; readonly owned: number }[];
}

export interface ILinkState {
  readonly intent: TShareIntent;
  readonly url: string;
  readonly token: string;
  /** Whether this link shows the owner's WhatsApp button. */
  readonly showContact: boolean;
}

/** One entry per intent; null while that link is off. */
export interface IDeckShareState {
  readonly deck: ILinkState | null;
  readonly missing: ILinkState | null;
}

// ---------------------------------------------------------------------------
// Error codes surfaced by the sharing routes
// ---------------------------------------------------------------------------

export const SHARE_LINK_UNAVAILABLE = 'SHARE_LINK_UNAVAILABLE';
export const DISPLAY_NAME_REQUIRED = 'DISPLAY_NAME_REQUIRED';
export const EMAIL_NOT_CONFIRMED = 'EMAIL_NOT_CONFIRMED';

export function isShareErrorCode(error: unknown, code: string): boolean {
  return error instanceof AuthFetchError && error.code === code;
}

/** A dead link: turned off, deleted, owner deleted or never existed (the API never says which). */
export function isShareLinkUnavailable(error: unknown): boolean {
  return error instanceof AuthFetchError && error.status === 404;
}

// ---------------------------------------------------------------------------
// Plain request functions. The visitor's session rides in the `ra_session`
// cookie: the public shared-deck call works without one and uses it, when
// present, so the API can tell the owner apart from a visitor.
// ---------------------------------------------------------------------------

export function sharedDeckImageDownloadPath(token: string): string {
  return `/api/shared/decks/${encodeURIComponent(token)}/image?download=1`;
}

export function sharedDeckImagePath(token: string): string {
  return `/api/shared/decks/${encodeURIComponent(token)}/image`;
}

export function getSharedDeck(token: string): Promise<ISharedDeckResponse> {
  return authFetch<ISharedDeckResponse>(`/shared/decks/${encodeURIComponent(token)}`);
}

export function getCoverage(token: string): Promise<ISharedDeckCoverage> {
  return authFetch<ISharedDeckCoverage>(`/shared/decks/${encodeURIComponent(token)}/coverage`);
}

export function copySharedDeck(token: string): Promise<{ deckId: number }> {
  return authFetch<{ deckId: number }>(`/shared/decks/${encodeURIComponent(token)}/copy`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getMatches(token: string): Promise<ISharedMatches> {
  return authFetch<ISharedMatches>(`/shared/decks/${encodeURIComponent(token)}/matches`);
}

export function getDeckShare(deckId: number | string): Promise<IDeckShareState> {
  return authFetch<IDeckShareState>(`/decks/${deckId}/share`);
}

export function enableDeckShare(deckId: number | string, intent: TShareIntent): Promise<ILinkState> {
  return authFetch<ILinkState>(`/decks/${deckId}/share`, { method: 'POST', body: JSON.stringify({ intent }) });
}

export function disableDeckShare(deckId: number | string, intent: TShareIntent): Promise<void> {
  return authFetch<void>(`/decks/${deckId}/share/${intent}`, { method: 'DELETE' });
}

export function setDeckShareContact(
  deckId: number | string,
  intent: TShareIntent,
  showContact: boolean,
): Promise<ILinkState> {
  return authFetch<ILinkState>(`/decks/${deckId}/share/${intent}`, {
    method: 'PATCH',
    body: JSON.stringify({ showContact }),
  });
}

/** Saves (or, with null, removes) the sharer's WhatsApp number. 400 on an invalid number. */
export function patchContact(whatsappNumber: string | null): Promise<{ whatsappNumber: string | null }> {
  return authFetch<{ whatsappNumber: string | null }>('/users/me/contact', {
    method: 'PATCH',
    body: JSON.stringify({ whatsappNumber }),
  });
}

export function patchDisplayName(displayName: string): Promise<{ displayName: string }> {
  return authFetch<{ displayName: string }>('/users/me/display-name', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  });
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
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: sharedDeckQueryKey(token, user?.id ?? null),
    queryFn: () => getSharedDeck(token),
    enabled: !isLoading,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error) => !isShareLinkUnavailable(error) && failureCount < 1,
  });
}

/**
 * The owner's own view of one of their links, for the share dialog's message.
 * Separate key from the visitor query so it refetches on every open; the
 * server records no "open" for the owner.
 */
export function useOwnSharedDeckQuery(token: string, enabled: boolean) {
  return useQuery({
    queryKey: ['shared-deck-own', token] as const,
    queryFn: () => getSharedDeck(token),
    enabled,
  });
}

/** The logged-in visitor's exact coverage of the shared deck. Not for the owner or anonymous visitors. */
export function useSharedCoverageQuery(token: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: sharedCoverageQueryKey(token, user?.id ?? null),
    queryFn: () => getCoverage(token),
    enabled: enabled && user !== null,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useCopySharedDeckMutation(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => copySharedDeck(token),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

/** The visitor's copies of each missing card. Only the missing-cards link answers it. */
export function useSharedMatchesQuery(token: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['shared-deck-matches', token, user?.id ?? 'anonymous'] as const,
    queryFn: () => getMatches(token),
    enabled: enabled && user !== null,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useDeckShareQuery(deckId: number | string) {
  return useQuery({
    queryKey: deckShareQueryKey(deckId),
    queryFn: () => getDeckShare(deckId),
    staleTime: Infinity,
  });
}

const EMPTY_SHARE_STATE: IDeckShareState = { deck: null, missing: null };

/** Replaces one intent's entry and leaves the other untouched. */
function withLink(state: IDeckShareState | undefined, intent: TShareIntent, link: ILinkState | null): IDeckShareState {
  return { ...(state ?? EMPTY_SHARE_STATE), [intent]: link };
}

export function useEnableDeckShareMutation(deckId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (intent: TShareIntent) => enableDeckShare(deckId, intent),
    onSuccess: (link) => {
      queryClient.setQueryData<IDeckShareState>(deckShareQueryKey(deckId), (state) =>
        withLink(state, link.intent, link),
      );
    },
  });
}

export function useSetDeckShareContactMutation(deckId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ intent, showContact }: { readonly intent: TShareIntent; readonly showContact: boolean }) =>
      setDeckShareContact(deckId, intent, showContact),
    onSuccess: (link) => {
      queryClient.setQueryData<IDeckShareState>(deckShareQueryKey(deckId), (state) =>
        withLink(state, link.intent, link),
      );
    },
  });
}

export function useDisableDeckShareMutation(deckId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (intent: TShareIntent) => disableDeckShare(deckId, intent).then(() => intent),
    onSuccess: (intent) => {
      queryClient.setQueryData<IDeckShareState>(deckShareQueryKey(deckId), (state) => withLink(state, intent, null));
    },
  });
}
