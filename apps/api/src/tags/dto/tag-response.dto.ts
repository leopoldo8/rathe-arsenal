/**
 * Shape returned by GET /tags and POST /tags.
 *
 * Mirrors the deck_tag table columns that are safe to expose (no userId).
 */
export interface ITagResponse {
  id: number;
  name: string;
  createdAt: Date;
}
