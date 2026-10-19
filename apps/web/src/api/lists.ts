import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { authFetch } from '../lib/auth-fetch';

export type TListKind = 'want' | 'sell';
export type TCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';

export const CONDITIONS: readonly TCondition[] = ['NM', 'LP', 'MP', 'HP', 'DMG'];
export const LINE_QUANTITY_MIN = 1;
export const LINE_QUANTITY_MAX = 20;
export const LIST_NAME_MAX = 80;
export const MULTIPLIER_MAX = 50;

export interface IListCardImage {
  readonly small: string;
  readonly large: string;
  readonly sources?: readonly { readonly small: string; readonly large: string }[];
}

export interface IListSummary {
  readonly id: number;
  readonly kind: TListKind;
  readonly name: string;
  readonly lineCount: number;
  readonly copyCount: number;
  readonly soldCount: number;
  readonly totalPriceCents: number | null;
  readonly previewImages: readonly IListCardImage[];
  readonly shared: boolean;
  readonly updatedAt: string;
}

export interface IPriceSuggestion {
  readonly cents: number;
  readonly approximate: boolean;
  readonly fetchedAt: string;
  readonly printing: string;
}

export interface IListLine {
  readonly id: number;
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  readonly type: string;
  readonly imageUrl: IListCardImage | null;
  readonly quantity: number;
  readonly printing: string | null;
  readonly printingLabel: string | null;
  readonly condition: TCondition | null;
  readonly priceCents: number | null;
  readonly sold: boolean;
  readonly suggestion: IPriceSuggestion | null;
}

export interface ICardList {
  readonly id: number;
  readonly kind: TListKind;
  readonly name: string;
  readonly notes: string | null;
  readonly totalPriceCents: number | null;
  readonly priceMultiplier: number | null;
  readonly lines: readonly IListLine[];
  readonly updatedAt: string;
}

export interface IListPrinting {
  readonly printing: string;
  readonly label: string;
  readonly suggestion: IPriceSuggestion | null;
}

export interface ICreateListBody {
  readonly kind: TListKind;
  readonly name: string;
  readonly fromDeckId?: number;
}

export interface IPatchListBody {
  readonly name?: string;
  readonly notes?: string;
  readonly totalPriceCents?: number | null;
  readonly priceMultiplier?: number | null;
}

export interface IAddLineBody {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly printing?: string | null;
  readonly condition?: TCondition | null;
  readonly priceCents?: number | null;
}

export interface IPatchLineBody {
  readonly quantity?: number;
  readonly printing?: string | null;
  readonly condition?: TCondition | null;
  readonly priceCents?: number | null;
  readonly sold?: boolean;
}

export const listsQueryKey = ['lists'] as const;
export const listQueryKey = (listId: number | string) => ['lists', String(listId)] as const;
export const listPrintingsQueryKey = (listId: number | string, cardIdentifier: string) =>
  ['lists', String(listId), 'printings', cardIdentifier] as const;

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export function useListsQuery() {
  const { token } = useAuth();
  return useQuery({
    queryKey: listsQueryKey,
    queryFn: () => authFetch<IListSummary[]>('/lists', {}, token),
  });
}

export function useListQuery(listId: number | string) {
  const { token } = useAuth();
  return useQuery({
    queryKey: listQueryKey(listId),
    queryFn: () => authFetch<ICardList>(`/lists/${listId}`, {}, token),
    retry: false,
  });
}

export function useListPrintingsQuery(listId: number | string, cardIdentifier: string | null) {
  const { token } = useAuth();
  return useQuery({
    queryKey: listPrintingsQueryKey(listId, cardIdentifier ?? ''),
    queryFn: () =>
      authFetch<IListPrinting[]>(`/lists/${listId}/printings/${encodeURIComponent(cardIdentifier ?? '')}`, {}, token),
    enabled: cardIdentifier !== null,
    staleTime: 60_000,
  });
}

export function useCreateListMutation() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ICreateListBody) =>
      authFetch<ICardList>('/lists', { method: 'POST', ...json(body) }, token),
    onSuccess: (list) => {
      queryClient.setQueryData<ICardList>(listQueryKey(list.id), list);
      void queryClient.invalidateQueries({ queryKey: listsQueryKey, exact: true });
    },
  });
}

export function useDeleteListMutation(listId: number | string) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authFetch<void>(`/lists/${listId}`, { method: 'DELETE' }, token),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: listQueryKey(listId) });
      void queryClient.invalidateQueries({ queryKey: listsQueryKey, exact: true });
    },
  });
}

/** Every list write answers with the whole list, so one response replaces the cache. */
function useListWrite<TVariables>(
  listId: number | string,
  request: (variables: TVariables, token: string | null) => Promise<ICardList>,
) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: TVariables) => request(variables, token),
    onSuccess: (list) => {
      queryClient.setQueryData<ICardList>(listQueryKey(listId), list);
      void queryClient.invalidateQueries({ queryKey: listsQueryKey, exact: true });
    },
  });
}

export function usePatchListMutation(listId: number | string) {
  return useListWrite<IPatchListBody>(listId, (body, token) =>
    authFetch<ICardList>(`/lists/${listId}`, { method: 'PATCH', ...json(body) }, token),
  );
}

export function useAddLineMutation(listId: number | string) {
  return useListWrite<IAddLineBody>(listId, (body, token) =>
    authFetch<ICardList>(`/lists/${listId}/lines`, { method: 'POST', ...json(body) }, token),
  );
}

export function usePatchLineMutation(listId: number | string) {
  return useListWrite<{ readonly lineId: number; readonly body: IPatchLineBody }>(listId, ({ lineId, body }, token) =>
    authFetch<ICardList>(`/lists/${listId}/lines/${lineId}`, { method: 'PATCH', ...json(body) }, token),
  );
}

export function useApplySuggestionsMutation(listId: number | string) {
  return useListWrite<readonly number[] | undefined>(listId, (lineIds, token) =>
    authFetch<ICardList>(
      `/lists/${listId}/apply-suggestions`,
      { method: 'POST', ...json(lineIds === undefined ? {} : { lineIds }) },
      token,
    ),
  );
}

export function useRemoveLineMutation(listId: number | string) {
  return useListWrite<number>(listId, (lineId, token) =>
    authFetch<ICardList>(`/lists/${listId}/lines/${lineId}`, { method: 'DELETE' }, token),
  );
}
