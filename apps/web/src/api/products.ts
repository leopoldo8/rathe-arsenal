import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { CSV_SOURCES_QUERY_KEY } from './csv-sources';
import { LIBRARY_QUERY_KEY } from './library';

// Mirrors apps/api/src/products/dtos/product-requests.dto.ts.

export interface IProductCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly quantity: number;
}

export interface IProduct {
  readonly key: string;
  readonly name: string;
  readonly kind: string;
  /** Classic Constructed, Blitz or Silver Age. */
  readonly format: string;
  readonly cardCount: number;
  readonly hero: {
    readonly cardIdentifier: string;
    readonly name: string;
    readonly imageUrl: { readonly small: string; readonly large: string } | null;
  };
  readonly cards: readonly IProductCard[];
}

export interface IImportProductVariables {
  readonly productKey: string;
  readonly addCards: boolean;
  readonly createDeck: boolean;
  readonly confirmRepeat?: boolean;
}

export interface IImportProductResponse {
  readonly source?: { readonly id: string; readonly label: string; readonly copies: number };
  readonly deckId?: number;
}

export const PRODUCTS_QUERY_KEY = ['products'] as const;

export function useProductsQuery(q: string) {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, q],
    queryFn: () => apiFetch<{ readonly products: readonly IProduct[] }>(`/products?q=${encodeURIComponent(q)}`),
  });
}

export function useImportProductMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productKey, ...body }: IImportProductVariables) =>
      apiFetch<IImportProductResponse>(`/products/${encodeURIComponent(productKey)}/import`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CSV_SOURCES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}
