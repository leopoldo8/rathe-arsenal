const DECK_LINK_PATTERN = /(?:https?:\/\/)?(?:www\.)?fabrary\.(?:net|com)\/decks\/([0-9A-HJKMNP-TV-Z]{26})(?![0-9A-Za-z])/i;

/** The deck id of the first Fabrary deck link inside any text, or null; the same rule as the API's. */
export function findFabraryDeckId(text: string): string | null {
  const match = DECK_LINK_PATTERN.exec(text);
  return match?.[1]?.toUpperCase() ?? null;
}
