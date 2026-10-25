import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { CSV_SOURCES_QUERY_KEY } from './csv-sources';
import { LIBRARY_QUERY_KEY } from './library';
import type { ICopyVersion } from './collection-versions';

// Mirrors apps/api/src/collection/reader/line-reader.types.ts and apps/api/src/collection/imports.

export type TLineOutcome = 'ready' | 'asks_color' | 'suggestion' | 'not_found' | 'bad_quantity';
export type TPendingReason = 'asks_color' | 'suggestion' | 'not_found' | 'bad_quantity';

export interface ICardImage {
  readonly small: string;
  readonly large: string;
}

export type TColorOption =
  | { readonly kind: 'pitch'; readonly pitch: 1 | 2 | 3; readonly cardIdentifier: string }
  | { readonly kind: 'unknown' };

export interface ILineSuggestion {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly pitch: number | null;
  readonly imageUrl: ICardImage | null;
}

export interface IReadLine {
  readonly lineNumber: number;
  readonly originalText: string;
  readonly outcome: TLineOutcome;
  readonly cardIdentifier: string | null;
  readonly name: string | null;
  readonly pitch: number | null;
  readonly imageUrl: ICardImage | null;
  readonly quantity: number | null;
  readonly quantityRaw: string | null;
  readonly suggestedQuantity: number | null;
  readonly options: readonly TColorOption[] | null;
  readonly suggestion: ILineSuggestion | null;
  readonly version: ICopyVersion;
  readonly versionNote: string | null;
  readonly notes: readonly string[];
}

export interface IReadImportResponse {
  readonly lines: readonly IReadLine[];
  /** The columns the reader used, in the file's order; empty for a paste. */
  readonly columns: readonly string[];
}

export type TReadImportInput = { readonly text: string } | { readonly file: File };

export interface IReadyLineBody extends Partial<ICopyVersion> {
  readonly cardIdentifier: string;
  readonly quantity: number;
}

export interface IPendingLineBody {
  readonly lineNumber: number;
  readonly originalText: string;
  readonly reason: TPendingReason;
  readonly suggestedCardIdentifier?: string;
}

export interface ICreateImportBody {
  readonly kind: 'csv' | 'paste';
  readonly name: string;
  readonly ready: readonly IReadyLineBody[];
  readonly pending: readonly IPendingLineBody[];
  readonly defaultVersion?: Partial<ICopyVersion>;
  readonly fileName?: string;
  readonly duplicateStrategy?: 'separate';
}

export interface ICreateImportResponse {
  readonly source: {
    readonly id: string;
    readonly kind: string;
    readonly label: string;
    readonly cardCount: number;
    readonly copies: number;
  };
  readonly pendingCount: number;
}

export interface IPendingLine {
  readonly id: number;
  readonly lineNumber: number;
  readonly originalText: string;
  readonly reason: TPendingReason;
  /** A number written in the line, offered as the quantity; the player confirms it. */
  readonly quantityHint: number | null;
  readonly options: readonly TColorOption[] | null;
  readonly suggestion: ILineSuggestion | null;
}

export interface IPendingImport {
  readonly sourceId: string;
  readonly label: string;
  readonly lines: readonly IPendingLine[];
}

export interface IPendingResponse {
  readonly imports: readonly IPendingImport[];
}

export interface IResolvePendingVariables {
  readonly id: number;
  readonly cardIdentifier: string;
  readonly quantity: number;
}

export const PENDING_QUERY_KEY = ['collection-pending'] as const;

function invalidateCollection(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: PENDING_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: CSV_SOURCES_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ['decks'] });
}

/** Reads a paste or a file and creates nothing. */
export function useReadImportMutation() {
  const apiFetch = useApiClient();
  return useMutation({
    mutationFn: (input: TReadImportInput) => {
      if ('file' in input) {
        const form = new FormData();
        form.append('file', input.file);
        return apiFetch<IReadImportResponse>('/collection/imports/read', { method: 'POST', body: form });
      }
      return apiFetch<IReadImportResponse>('/collection/imports/read', {
        method: 'POST',
        body: JSON.stringify({ text: input.text }),
      });
    },
  });
}

export function useCreateImportMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ICreateImportBody) =>
      apiFetch<ICreateImportResponse>('/collection/imports', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => invalidateCollection(queryClient),
  });
}

export function usePendingLinesQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: PENDING_QUERY_KEY,
    queryFn: () => apiFetch<IPendingResponse>('/collection/pending'),
  });
}

export function useResolvePendingMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: IResolvePendingVariables) =>
      apiFetch<unknown>(`/collection/pending/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => invalidateCollection(queryClient),
  });
}

export function useDeletePendingMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/collection/pending/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateCollection(queryClient),
  });
}
