import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { authFetch } from '../lib/auth-fetch';
import { isShareLinkUnavailable } from './shared-decks';
import { listsQueryKey, type IListCardImage, type IListSummary, type TCondition, type TListKind } from './lists';

// Mirrors the shared-list contract of the API (.specs/features/shared-lists/contract.md).

export interface ISharedListLine {
  readonly id: number;
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  readonly type: string;
  readonly imageUrl: IListCardImage | null;
  readonly quantity: number;
  readonly printingLabel: string | null;
  /** Sell lists: the version the seller named; `''` where they did not. Absent on answers that predate it. */
  readonly printingCode?: string;
  readonly edition?: string;
  readonly finish?: string;
  readonly setName?: string | null;
  readonly condition: TCondition | null;
  readonly priceCents: number | null;
  readonly sold: boolean;
  /** Want list, signed-in visitor who is not the owner: what the visitor owns and can spare of the card. */
  readonly owned?: number | null;
  readonly spare?: number | null;
  /** The holding deck that keeps the most copies, the reason none is spare. */
  readonly spareReason?: { readonly deckName: string; readonly copies: number } | null;
  /** The one version every spare copy of the card shares, when they agree. */
  readonly spareVersion?: ISpareVersion | null;
  /** TCGplayer in dollars times 7, as cents; null when no printing is priced. */
  readonly suggestedCents?: number | null;
}

export interface ISpareVersion {
  readonly printingCode: string;
  readonly edition: string;
  readonly finish: string;
  readonly condition: string;
  readonly setName: string | null;
}

/** The visitor's own shared want list, offered to the sharer in return. */
export interface ISharedVisitorList {
  readonly name: string;
  readonly url: string;
  readonly lines: readonly {
    readonly cardIdentifier: string;
    readonly name: string;
    readonly pitch: 1 | 2 | 3 | null;
    readonly quantity: number;
    readonly suggestedCents: number | null;
  }[];
}

export interface ISharedListResponse {
  readonly kind: TListKind;
  readonly token: string;
  readonly url: string;
  readonly name: string;
  readonly notes: string | null;
  readonly sharerName: string;
  /** Digits with country code; set only when the owner saved a number and left the link's switch on. */
  readonly contactWhatsapp: string | null;
  readonly isOwner: boolean;
  /** Only for the owner, to link back to the editor. */
  readonly listId: number | null;
  readonly totalPriceCents: number | null;
  readonly updatedAt: string;
  /** True while a signed-in visitor of a want list owes the spare-rule question; absent on answers that predate the visitor views. */
  readonly spareNeedsRule?: boolean;
  readonly visitorList?: ISharedVisitorList | null;
  readonly lines: readonly ISharedListLine[];
}

export interface ISharedListMatches {
  readonly lines: readonly {
    readonly lineId: number;
    readonly owned: number;
    readonly missingInDecks: number;
    /** Each of the visitor's decks that misses the card, with its own count. */
    readonly decks?: readonly { readonly deckId: number; readonly deckName: string; readonly missing: number }[];
  }[];
}

export interface IListLinkState {
  readonly intent: TListKind;
  readonly url: string;
  readonly token: string;
  readonly showContact: boolean;
}

export function sharedListImageDownloadPath(token: string): string {
  return `/api/shared/lists/${encodeURIComponent(token)}/image?download=1`;
}

export const listShareQueryKey = (listId: number | string) => ['list-share', String(listId)] as const;
export const sharedListQueryKey = (token: string, visitorId: string | null) =>
  ['shared-list', token, visitorId ?? 'anonymous'] as const;

/** The owner's own link of this list; null while sharing is off. */
export function useListShareQuery(listId: number | string) {
  return useQuery({
    queryKey: listShareQueryKey(listId),
    queryFn: () => authFetch<IListLinkState | null>(`/lists/${listId}/share`),
    staleTime: Infinity,
  });
}

/** Turning a link on or off changes the "Compartilhada" badge of the index. */
function useLinkWrite<TVariables>(
  listId: number | string,
  request: (variables: TVariables) => Promise<IListLinkState | null>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: TVariables) => request(variables),
    onSuccess: (link) => {
      queryClient.setQueryData<IListLinkState | null>(listShareQueryKey(listId), link);
      queryClient.setQueryData<IListSummary[]>(listsQueryKey, (lists) =>
        lists?.map((list) => (String(list.id) === String(listId) ? { ...list, shared: link !== null } : list)),
      );
      void queryClient.invalidateQueries({ queryKey: listsQueryKey, exact: true });
    },
  });
}

export function useEnableListShareMutation(listId: number | string) {
  return useLinkWrite<void>(listId, () =>
    authFetch<IListLinkState>(`/lists/${listId}/share`, { method: 'POST', body: JSON.stringify({}) }),
  );
}

export function useSetListShareContactMutation(listId: number | string) {
  return useLinkWrite<boolean>(listId, (showContact) =>
    authFetch<IListLinkState>(`/lists/${listId}/share`, { method: 'PATCH', body: JSON.stringify({ showContact }) }),
  );
}

export function useDisableListShareMutation(listId: number | string) {
  return useLinkWrite<void>(listId, async () => {
    await authFetch<void>(`/lists/${listId}/share`, { method: 'DELETE' });
    return null;
  });
}

/**
 * Loads the public shared list. Every successful load records an "open" on
 * the server, so it never refetches on its own and a dead link is not retried.
 * The key carries the visitor, so signing in on the page refetches once.
 */
export function useSharedListQuery(token: string) {
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: sharedListQueryKey(token, user?.id ?? null),
    queryFn: () => authFetch<ISharedListResponse>(`/shared/lists/${encodeURIComponent(token)}`),
    enabled: !isLoading,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: (failureCount, error) => !isShareLinkUnavailable(error) && failureCount < 1,
  });
}

/** What the logged-in visitor already has, per line. Not for the owner or anonymous visitors. */
export function useSharedListMatchesQuery(token: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['shared-list-matches', token, user?.id ?? 'anonymous'] as const,
    queryFn: () => authFetch<ISharedListMatches>(`/shared/lists/${encodeURIComponent(token)}/matches`),
    enabled: enabled && user !== null,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export type TListVisitorEventKind = 'offer' | 'buy';

/** Tells the sharer's counts that the visitor offered cards ("offer") or asked for some ("buy"). The kind only, never any content. */
export function postListEvent(token: string, kind: TListVisitorEventKind): Promise<void> {
  return authFetch<void>(`/shared/lists/${encodeURIComponent(token)}/events`, {
    method: 'POST',
    body: JSON.stringify({ kind }),
  });
}
