import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../lib/api-client';

// ---------------------------------------------------------------------------
// Types — mirrors apps/api/src/decks/tags/dtos/tag-response.dto.ts
// ---------------------------------------------------------------------------

export interface ITagResponse {
  readonly id: number;
  readonly name: string;
  readonly createdAt: string;
}

export interface ITagListResponse {
  readonly tags: readonly ITagResponse[];
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const TAGS_QUERY_KEY = ['tags'] as const;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetches the authenticated user's tags from GET /api/tags.
 * The result is cached for the session (staleTime: Infinity) because the
 * tag list only changes on create/delete mutations, which invalidate this key.
 */
export function useTagsQuery() {
  const apiFetch = useApiClient();
  return useQuery({
    queryKey: TAGS_QUERY_KEY,
    queryFn: () => apiFetch<ITagListResponse>('/tags'),
    staleTime: Infinity,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface ICreateTagBody {
  readonly name: string;
}

/**
 * Creates a new user tag via POST /api/tags.
 * On success: invalidates TAGS_QUERY_KEY so the tag list refreshes.
 *
 * Error contract:
 * - 422: the user has reached the 200-tag limit. The mutation error surfaces
 *   this to the caller via mutation.error; callers render the friendly message.
 */
export function useCreateTagMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ICreateTagBody) =>
      apiFetch<ITagResponse>('/tags', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY });
    },
  });
}

/**
 * Deletes a user tag via DELETE /api/tags/:id.
 * On success: invalidates TAGS_QUERY_KEY + DECKS_QUERY_KEY + all deck-detail
 * entries (broad invalidation — deletion removes the tag from every deck that
 * carried it, so list + individual details can be stale).
 */
export function useDeleteTagMutation() {
  const apiFetch = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagId: number) =>
      apiFetch<void>(`/tags/${tagId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TAGS_QUERY_KEY });
      // Invalidate the deck list — tag deletion strips the tag from all decks
      void queryClient.invalidateQueries({ queryKey: ['decks'] });
      // Broad invalidation for every deck-detail entry
      void queryClient.invalidateQueries({ queryKey: ['deck-detail'] });
    },
  });
}
