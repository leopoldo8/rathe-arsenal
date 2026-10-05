import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { deckDetailQueryKey } from './deck-detail';
import { SWAPS_QUERY_KEY, type IRationaleDetail } from './swaps';

export type TAlternativeGroup = 'very_close' | 'close' | 'other_pitch' | 'generic' | 'search';

export interface IAlternativeImageUrl {
  readonly small: string;
  readonly large: string;
  readonly sources: readonly { readonly small: string; readonly large: string }[];
}

export interface IAlternativeCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly imageUrl: IAlternativeImageUrl | null;
  readonly freeCopies: number;
  readonly priceCents: number | null;
  readonly productUrl: string | null;
  readonly rationale: IRationaleDetail & { readonly relaxed: 'pitch' | 'class' | null };
}

export interface IAlternativeGroup {
  readonly group: TAlternativeGroup;
  readonly cards: readonly IAlternativeCard[];
}

export interface IAlternativesResponse {
  readonly needed: number;
  readonly groups: readonly IAlternativeGroup[];
}

/** An active replacement listed on the deck detail. */
export interface IDeckReplacement {
  readonly id: string;
  readonly slot: string;
  readonly originalCardIdentifier: string;
  /** The catalog name of the original, as the server sends it. */
  readonly originalName: string;
  readonly replacementCardIdentifier: string;
  readonly quantity: number;
  readonly originalOwned: boolean;
}

export interface IPickReplacementVariables {
  readonly originalCardIdentifier: string;
  readonly slot: string;
  readonly replacementCardIdentifier: string;
  readonly pickedFrom: TAlternativeGroup;
}

export type TResolveAction = 'revert' | 'keep';

export interface IAlternativesTarget {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly slot: string;
}

/** The server takes no name search shorter than this. */
export const ALTERNATIVES_MIN_QUERY_LENGTH = 2;

export function alternativesQueryKey(deckId: number, target: IAlternativesTarget, query: string | undefined) {
  return ['alternatives', deckId, target.cardIdentifier, target.slot, query ?? null] as const;
}

export function useAlternativesQuery(deckId: number, target: IAlternativesTarget, query: string | undefined) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: alternativesQueryKey(deckId, target, query),
    queryFn: () => {
      const params = new URLSearchParams({ cardIdentifier: target.cardIdentifier, slot: target.slot });
      if (query !== undefined) params.set('q', query);
      return apiFetch<IAlternativesResponse>(`/decks/${deckId}/alternatives?${params.toString()}`);
    },
    retry: false,
  });
}

/** A pick, an undo or a keep changes the deck list, readiness and the swaps shown, so all three refresh. */
function useRefreshDeck(deckId: number): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(String(deckId)) });
    void queryClient.invalidateQueries({ queryKey: SWAPS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['decks'] });
  };
}

export function usePickReplacement(deckId: number) {
  const apiFetch = useApiClient();
  const refresh = useRefreshDeck(deckId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: IPickReplacementVariables) =>
      apiFetch<{ replacement: unknown }>(`/decks/${deckId}/replacements`, {
        method: 'POST',
        body: JSON.stringify(variables),
      }),
    onSuccess: refresh,
    // A refused pick means the deck moved on since the list was fetched.
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: deckDetailQueryKey(String(deckId)) });
    },
  });
}

export function useResolveReplacement(deckId: number) {
  const apiFetch = useApiClient();
  const refresh = useRefreshDeck(deckId);
  return useMutation({
    mutationFn: ({ id, action }: { readonly id: string; readonly action: TResolveAction }) =>
      apiFetch<{ replacement: unknown }>(`/replacements/${id}/${action}`, { method: 'POST' }),
    onSuccess: refresh,
  });
}
