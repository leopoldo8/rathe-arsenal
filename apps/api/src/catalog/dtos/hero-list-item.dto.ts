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
   * The `Hero` enum value for this hero card (e.g. "Kayo", "Dorinthea").
   * This is what per-card `legalHeroes` lists reference — NOT the
   * cardIdentifier. The web cascade check needs it to compare a card's
   * `legalHeroes` against the deck's selected hero. Null only if the
   * catalog entry has no hero enum (should not happen for hero cards).
   */
  readonly hero: string | null;
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
   * Card face image. `sources` is the ordered fallback list — CardArt and
   * CardLightbox cycle through these on `<img>` `onError` so heroes that
   * only ship foiled / alternate-art variants still render.
   * Null when the source catalog entry has no image code at all.
   */
  readonly imageUrl: {
    readonly small: string;
    readonly large: string;
    readonly sources: readonly { readonly small: string; readonly large: string }[];
  } | null;
}

export interface IHeroListResponse {
  readonly heroes: readonly IHeroListItem[];
}
