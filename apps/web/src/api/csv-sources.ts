import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';
import { LIBRARY_QUERY_KEY } from './library';
import type { ICsvDelta, ISkippedCsvRow } from './csv-upload.types';

// ---------------------------------------------------------------------------
// Types — mirrors apps/api/src/collection/sources/sources.service.ts
// ---------------------------------------------------------------------------

export interface ICsvSource {
  readonly id: string;
  readonly userId: string;
  readonly kind: 'csv';
  readonly label: string | null;
  readonly originalFilename: string | null;
  readonly contentHash: string | null;
  readonly cardCount: number | null;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IAffectedDeck {
  readonly id: number;
  readonly name: string;
  readonly currentEffectivePercent: number;
}

export interface IPreviewDeleteResult {
  readonly cardsRemoved: number;
  readonly affectedDecks: readonly IAffectedDeck[];
}

export interface IDeleteSourceResult {
  readonly deleted: true;
  readonly recomputeWarning?: boolean;
}

// ---------------------------------------------------------------------------
// Upload types — mirrors upload-csv.response.dto.ts
// ---------------------------------------------------------------------------

export type { ICsvDelta, ISkippedCsvRow };

export interface ICreatedUploadResponse {
  readonly kind: 'created';
  readonly sourceId: string;
  readonly cardCount: number;
  readonly skippedRows: readonly ISkippedCsvRow[];
}

export interface IUpdatedUploadResponse {
  readonly kind: 'updated';
  readonly sourceId: string;
  readonly cardCount: number;
  readonly delta: ICsvDelta;
  readonly skippedRows: readonly ISkippedCsvRow[];
}

export interface IReplacedUploadResponse {
  readonly kind: 'replaced';
  readonly sourceId: string;
  readonly cardCount: number;
  readonly skippedRows: readonly ISkippedCsvRow[];
}

export interface IExactMatchUploadResponse {
  readonly kind: 'exact-match';
  readonly existingSourceId: string;
  readonly existingLabel: string | null;
  readonly cardCount: number;
  readonly skippedRows: readonly ISkippedCsvRow[];
}

export interface IPartialOverlapUploadResponse {
  readonly kind: 'partial-overlap';
  readonly existingSourceId: string;
  readonly existingLabel: string | null;
  readonly similarityScore: number;
  readonly delta: ICsvDelta;
  readonly cardCount: number;
  readonly skippedRows: readonly ISkippedCsvRow[];
}

export interface ICancelledUploadResponse {
  readonly kind: 'cancelled';
}

export type IUploadCsvResponse =
  | ICreatedUploadResponse
  | IUpdatedUploadResponse
  | IReplacedUploadResponse
  | IExactMatchUploadResponse
  | IPartialOverlapUploadResponse
  | ICancelledUploadResponse;

// ---------------------------------------------------------------------------
// Upload action
// ---------------------------------------------------------------------------

export type TCsvUploadAction = 'auto' | 'separate' | 'replace' | 'update' | 'cancel';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const CSV_SOURCES_QUERY_KEY = ['csv-sources'] as const;

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetches all `kind='csv'` sources for the authenticated user.
 * GET /api/collection/sources
 */
export function useCsvSourcesQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: CSV_SOURCES_QUERY_KEY,
    queryFn: () => apiFetch<ICsvSource[]>('/collection/sources'),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Upload mutation
// ---------------------------------------------------------------------------

interface IUploadCsvVariables {
  readonly file: File;
  readonly action?: TCsvUploadAction;
  readonly targetSourceId?: string;
}

/**
 * Uploads a CSV file (multipart). Returns the discriminated union response.
 * On `created | replaced | updated`, invalidates:
 *   - `['csv-sources']` — source list
 *   - `['library']`     — library totals
 *   - `['decks']`       — deck readiness
 */
export function useUploadCsvMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<IUploadCsvResponse, Error, IUploadCsvVariables>({
    mutationFn: async ({ file, action, targetSourceId }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (action !== undefined) formData.append('action', action);
      if (targetSourceId !== undefined) formData.append('targetSourceId', targetSourceId);

      return apiFetch<IUploadCsvResponse>('/collection/csv', {
        method: 'POST',
        body: formData,
      });
    },

    onSuccess: (data) => {
      if (
        data.kind === 'created' ||
        data.kind === 'replaced' ||
        data.kind === 'updated'
      ) {
        void queryClient.invalidateQueries({ queryKey: CSV_SOURCES_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
        void queryClient.invalidateQueries({ queryKey: ['decks'] });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Patch mutation (optimistic)
// ---------------------------------------------------------------------------

interface IPatchCsvSourceVariables {
  readonly sourceId: string;
  readonly active?: boolean;
  readonly label?: string;
}

interface IPatchMutationContext {
  readonly previous: readonly ICsvSource[] | undefined;
}

/**
 * Updates `active` or `label` on a CSV source.
 * Optimistic: updates local cache immediately; rolls back on error.
 * PATCH /api/collection/sources/:id
 */
export function usePatchCsvSourceMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ICsvSource, Error, IPatchCsvSourceVariables, IPatchMutationContext>({
    mutationFn: ({ sourceId, active, label }) => {
      const body: { active?: boolean; label?: string } = {};
      if (active !== undefined) body.active = active;
      if (label !== undefined) body.label = label;
      return apiFetch<ICsvSource>(`/collection/sources/${sourceId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    },

    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: CSV_SOURCES_QUERY_KEY });
      const previous = queryClient.getQueryData<readonly ICsvSource[]>(CSV_SOURCES_QUERY_KEY);

      if (previous !== undefined) {
        queryClient.setQueryData<readonly ICsvSource[]>(
          CSV_SOURCES_QUERY_KEY,
          previous.map((s) => {
            if (s.id !== variables.sourceId) return s;
            return {
              ...s,
              ...(variables.active !== undefined ? { active: variables.active } : {}),
              ...(variables.label !== undefined ? { label: variables.label } : {}),
            };
          }),
        );
      }

      return { previous };
    },

    onError: (_err, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<readonly ICsvSource[]>(
          CSV_SOURCES_QUERY_KEY,
          context.previous,
        );
      }
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CSV_SOURCES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Preview delete query (lazy / one-shot)
// ---------------------------------------------------------------------------

/**
 * One-shot query to preview the impact of deleting a source.
 * GET /api/collection/sources/:id?preview=true
 *
 * Returns the fetch function directly so the caller can invoke it lazily
 * when opening the delete modal (not a persistent query).
 */
export function usePreviewDeleteCsvSource() {
  const apiFetch = useApiClient();
  return (sourceId: string) =>
    apiFetch<IPreviewDeleteResult>(`/collection/sources/${sourceId}?preview=true`);
}

// ---------------------------------------------------------------------------
// Delete mutation (NOT optimistic — destructive)
// ---------------------------------------------------------------------------

/**
 * Deletes a CSV source. NOT optimistic.
 * DELETE /api/collection/sources/:id
 * On success, invalidates `['csv-sources']`, `['library']`, `['decks']`.
 */
export function useDeleteCsvSourceMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<IDeleteSourceResult, Error, string>({
    mutationFn: (sourceId) =>
      apiFetch<IDeleteSourceResult>(`/collection/sources/${sourceId}`, {
        method: 'DELETE',
      }),

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CSV_SOURCES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
      // Also invalidate any open deck details
      void queryClient.invalidateQueries({ queryKey: ['deck-detail'] });
    },
  });
}
