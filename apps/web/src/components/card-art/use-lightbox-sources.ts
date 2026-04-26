/**
 * Pure helper that turns a card `imageUrl` (with optional `sources`) into
 * the ordered list of large-image URLs the CardLightbox needs.
 *
 * Centralised so every call-site (library, deck-detail, reviews) wires
 * fallbacks the same way — without it, sets that only publish foiled
 * artwork (Armory Decks, judge promos) would surface "Card art
 * unavailable" in the lightbox even though `CardArt` already had a
 * working source in the grid.
 */

export interface IImageUrl {
  readonly small: string;
  readonly large: string;
  readonly sources?: readonly { readonly small: string; readonly large: string }[];
}

export function lightboxSourcesFor(imageUrl: IImageUrl | null | undefined): readonly string[] {
  if (!imageUrl) return [];
  if (imageUrl.sources && imageUrl.sources.length > 0) {
    return imageUrl.sources.map((s) => s.large);
  }
  return [imageUrl.large];
}
