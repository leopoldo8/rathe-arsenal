import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  /** The version of a sell line (door 1); `''` is "Não sei". */
  readonly printingCode: string;
  readonly edition: string;
  readonly finish: string;
  /** The catalog key the version points at; null while no printing code is named. */
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
  readonly printingCode: string;
  readonly edition: string;
  readonly finish: string;
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

/** The three parts of a version a line names besides its condition. */
export interface ILineVersionBody {
  readonly printingCode?: string;
  readonly edition?: string;
  readonly finish?: string;
}

export const NO_LINE_VERSION: Required<ILineVersionBody> = { printingCode: '', edition: '', finish: '' };

export interface IAddLineBody extends ILineVersionBody {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly condition?: TCondition | null;
  readonly priceCents?: number | null;
}

export interface IPatchLineBody extends ILineVersionBody {
  readonly quantity?: number;
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
  return useQuery({
    queryKey: listsQueryKey,
    queryFn: () => authFetch<IListSummary[]>('/lists'),
  });
}

export function useListQuery(listId: number | string) {
  return useQuery({
    queryKey: listQueryKey(listId),
    queryFn: () => authFetch<ICardList>(`/lists/${listId}`),
    retry: false,
  });
}

export function useListPrintingsQuery(listId: number | string, cardIdentifier: string | null) {
  return useQuery({
    queryKey: listPrintingsQueryKey(listId, cardIdentifier ?? ''),
    queryFn: () =>
      authFetch<IListPrinting[]>(`/lists/${listId}/printings/${encodeURIComponent(cardIdentifier ?? '')}`),
    enabled: cardIdentifier !== null,
    staleTime: 60_000,
  });
}

export function useCreateListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ICreateListBody) =>
      authFetch<ICardList>('/lists', { method: 'POST', ...json(body) }),
    onSuccess: (list) => {
      queryClient.setQueryData<ICardList>(listQueryKey(list.id), list);
      void queryClient.invalidateQueries({ queryKey: listsQueryKey, exact: true });
    },
  });
}

export function useDeleteListMutation(listId: number | string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authFetch<void>(`/lists/${listId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: listQueryKey(listId) });
      void queryClient.invalidateQueries({ queryKey: listsQueryKey, exact: true });
    },
  });
}

/** Every list write answers with the whole list, so one response replaces the cache. */
function useListWrite<TVariables>(
  listId: number | string,
  request: (variables: TVariables) => Promise<ICardList>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: TVariables) => request(variables),
    onSuccess: (list) => {
      queryClient.setQueryData<ICardList>(listQueryKey(listId), list);
      void queryClient.invalidateQueries({ queryKey: listsQueryKey, exact: true });
    },
  });
}

export function usePatchListMutation(listId: number | string) {
  return useListWrite<IPatchListBody>(listId, (body) =>
    authFetch<ICardList>(`/lists/${listId}`, { method: 'PATCH', ...json(body) }),
  );
}

export function useAddLineMutation(listId: number | string) {
  return useListWrite<IAddLineBody>(listId, (body) =>
    authFetch<ICardList>(`/lists/${listId}/lines`, { method: 'POST', ...json(body) }),
  );
}

export function usePatchLineMutation(listId: number | string) {
  return useListWrite<{ readonly lineId: number; readonly body: IPatchLineBody }>(listId, ({ lineId, body }) =>
    authFetch<ICardList>(`/lists/${listId}/lines/${lineId}`, { method: 'PATCH', ...json(body) }),
  );
}

export function useApplySuggestionsMutation(listId: number | string) {
  return useListWrite<readonly number[] | undefined>(listId, (lineIds) =>
    authFetch<ICardList>(
      `/lists/${listId}/apply-suggestions`,
      { method: 'POST', ...json(lineIds === undefined ? {} : { lineIds }) },
    ),
  );
}

export function useRemoveLineMutation(listId: number | string) {
  return useListWrite<number>(listId, (lineId) =>
    authFetch<ICardList>(`/lists/${listId}/lines/${lineId}`, { method: 'DELETE' }),
  );
}
