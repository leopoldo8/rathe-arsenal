import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { deckDetailQueryKey } from './deck-detail';

export type TStoreState = 'priced' | 'store_lacks' | 'not_on_site' | 'looking_up' | 'no_price';

export interface IMissingStandIn {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  /** Copies the stand-in covers: the unused ones it could take, or the ones an active replacement holds. */
  readonly copies: number;
  readonly savingCents: number | null;
  readonly used: boolean;
  readonly replacementId: string | null;
}

export interface IMissingLine {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly imageUrl: string | null;
  readonly deckNeeded: number;
  readonly inventoryNeeded: number;
  readonly deckQuantity: number;
  readonly ownedTotal: number;
  readonly ownedElsewhere: number;
  readonly state: TStoreState;
  readonly unitPriceCents: number | null;
  readonly lineCents: number | null;
  readonly availableCopies: number | null;
  readonly foilOnly: boolean;
  readonly promoOnly: boolean;
  readonly productUrl: string | null;
  readonly searchUrl: string | null;
  readonly standIn: IMissingStandIn | null;
}

export interface IMissingSummary {
  readonly totalCopies: number;
  readonly buyCopies: number;
  readonly buyCents: number;
  readonly lacksCopies: number;
  readonly notOnSiteCopies: number;
  readonly ownedCopies: number;
  readonly standInCopies: number;
  readonly lookingUp: number;
  readonly noPrice: number;
  readonly availabilityCheckedAt: string | null;
  readonly priceValidDays: number;
}

export interface IMissingListResponse {
  readonly summary: IMissingSummary;
  readonly lines: readonly IMissingLine[];
}

export interface ISetOwnedResponse {
  readonly ownedTotal: number;
  readonly previousManualQuantity: number;
}

/** How often the list asks again while a price is still being looked up. */
export const LOOKUP_POLL_MS = 5000;

export function missingListQueryKey(deckId: number) {
  return ['missing-list', deckId] as const;
}

/** The deck page's card reads stored prices (`lookups=read`), so it has its own cache entry apart from the list page's. */
export function storedMissingListQueryKey(deckId: number) {
  return [...missingListQueryKey(deckId), 'stored'] as const;
}

/** The owner's list page: opening it asks the API to queue the price lookups still missing. */
export function useMissingListQuery(deckId: number) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: missingListQueryKey(deckId),
    queryFn: () => apiFetch<IMissingListResponse>(`/decks/${deckId}/missing`),
    refetchInterval: (query) => ((query.state.data?.summary.lookingUp ?? 0) > 0 ? LOOKUP_POLL_MS : false),
  });
}

/** The deck page's summary card: stored prices only, so opening a deck never spends lookup credits (D51). */
export function useStoredMissingListQuery(deckId: number) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: storedMissingListQueryKey(deckId),
    queryFn: () => apiFetch<IMissingListResponse>(`/decks/${deckId}/missing?lookups=read`),
  });
}

/** Owned copies, a swap and an undo all change what the deck still needs, so the list and the deck page read again. */
export function useRefreshMissing(deckId: number): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: missingListQueryKey(deckId) });
    void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(String(deckId)) });
    void queryClient.invalidateQueries({ queryKey: ['decks'] });
  };
}

export interface ISetOwnedVariables {
  readonly cardIdentifier: string;
  readonly ownedTotal: number;
}

export function useSetOwnedMutation(deckId: number) {
  const apiFetch = useApiClient();
  const refresh = useRefreshMissing(deckId);
  return useMutation({
    mutationFn: ({ cardIdentifier, ownedTotal }: ISetOwnedVariables) =>
      apiFetch<ISetOwnedResponse>('/collection/owned', {
        method: 'PUT',
        body: JSON.stringify({ deckId, cardIdentifier, ownedTotal }),
      }),
    onSuccess: refresh,
  });
}
