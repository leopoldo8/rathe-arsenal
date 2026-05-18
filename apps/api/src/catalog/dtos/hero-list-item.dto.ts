/**
 * Slim projection returned by GET /catalog/heroes.
 *
 * Contains only the fields the web HeroDropdown needs — keeps the response
 * under ~22KB for the full ~143-hero set without the bulky sources[] array or
 * engine-internal fields.
 */
export interface IHeroListItem {
  readonly cardIdentifier: string;
  readonly name: string;
  /**
   * True for "young hero" versions designated for Blitz / Silver Age.
   * Always a boolean (never undefined) — coerced by U2 catalog normalization.
   */
  readonly young: boolean;
  /**
   * Formats in which this hero card is tournament-legal.
   * Serialized as plain strings so the web client stays engine-free.
   */
  readonly legalFormats: readonly string[];
  /**
   * Card face image URLs in small and large WebP sizes.
   * Null when the source catalog entry has no image code.
   */
  readonly imageUrl: { readonly small: string; readonly large: string } | null;
}

export interface IHeroListResponse {
  readonly heroes: readonly IHeroListItem[];
}
