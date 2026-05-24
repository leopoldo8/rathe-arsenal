/**
 * Shape returned by POST /tags (single tag) and embedded in ITagListResponse.
 *
 * Mirrors the deck_tag table columns that are safe to expose (no userId).
 */
export interface ITagResponse {
  id: number;
  name: string;
  createdAt: Date;
}

/**
 * Shape returned by GET /tags. Wraps the array in an envelope to match the
 * project's response convention (see ITrackedDeckListResponse for the same
 * pattern). The frontend `useTagsQuery` reads `data.tags`, so a bare-array
 * response would silently hide every tag from the autocomplete.
 */
export interface ITagListResponse {
  tags: ITagResponse[];
}
