/**
 * Hero/format legality helpers (frontend mirror of the engine check).
 *
 * The engine's `computeDeckLegality` rejects a hero whose own
 * `legalFormats` list does not include the target format (step 1 of the
 * hero checks). We replicate just that single comparison here so the
 * deck-creation UI can gate hero selection by format WITHOUT importing
 * the engine into the web bundle (per the no-engine-in-web constraint).
 *
 * The `young` / `requiresYoungHero` nuance does not need a separate check:
 * a young hero already carries the young-only formats (Blitz, Silver Age)
 * in its `legalFormats`, and an adult hero carries the adult formats, so
 * the `legalFormats.includes(format)` test alone is sufficient.
 */
import type { IHeroListItem } from '../api/catalog';

/**
 * Whether a hero is selectable in the given format.
 *
 * An empty `format` means "no format constraint yet" — every hero is
 * selectable until the user picks a format.
 */
export function isHeroLegalForFormat(
  hero: IHeroListItem,
  format: string,
): boolean {
  if (format.length === 0) return true;
  return hero.legalFormats.includes(format);
}
