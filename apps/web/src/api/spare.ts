import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import type { ICopyVersion } from './collection-versions';

// Mirrors apps/api/src/collection/spare/dtos/spare-response.dto.ts.
export type TSpareRule = 'within_format' | 'any_deck' | 'per_deck';

export const SPARE_RULES: readonly TSpareRule[] = ['within_format', 'any_deck', 'per_deck'];

export type TSpareCounts = Readonly<Record<TSpareRule, number>>;

export interface ISpareRow extends ICopyVersion {
  readonly cardIdentifier: string;
  readonly spare: number;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  readonly imageUrl: string | null;
  readonly setName: string | null;
  /** The foil finishes this version could be; empty when the card (or its printing) has none. */
  readonly foilFinishes: readonly string[];
  /** TCGplayer in dollars times 7, in reais as cents; null when no printing is priced. */
  readonly suggestedCents: number | null;
  readonly storeCents: number | null;
}

export interface IDeckUse {
  readonly deckId: number;
  readonly deckName: string;
  readonly format: string;
  readonly deck: number;
  readonly inventory: number;
  readonly use: number;
}

export interface INonHoldingDeck {
  readonly deckId: number;
  readonly deckName: string;
  readonly status: string;
}

export interface ISpareWhy {
  readonly owned: number;
  readonly held: number;
  readonly spare: number;
  readonly holders: readonly IDeckUse[];
  readonly notHolding: readonly INonHoldingDeck[];
}

export interface IIdeaDeck {
  readonly deckId: number;
  readonly deckName: string;
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  readonly use: number;
}

export interface ISpareResponse {
  readonly needsRule: boolean;
  readonly rule: TSpareRule | null;
  readonly counts: TSpareCounts;
  readonly totalSpare: number;
  readonly rows: readonly ISpareRow[];
  readonly why: Readonly<Record<string, ISpareWhy>>;
  readonly ideaDecks: readonly IIdeaDeck[];
}

export const SPARE_QUERY_KEY = ['spare'] as const;

/** One read of what the player can sell or offer: computed by the API on every call, never stored. */
export function useSpareQuery(enabled = true) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: SPARE_QUERY_KEY,
    queryFn: () => apiFetch<ISpareResponse>('/collection/spare'),
    enabled,
  });
}

/** Stores the player's rule, then every screen that shows a spare count reads again. */
export function useSetSpareRuleMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rule: TSpareRule) => apiFetch<{ rule: TSpareRule }>('/users/me/spare-rule', { method: 'PUT', body: JSON.stringify({ rule }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SPARE_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['shared-deck'] });
      void queryClient.invalidateQueries({ queryKey: ['shared-list'] });
    },
  });
}
