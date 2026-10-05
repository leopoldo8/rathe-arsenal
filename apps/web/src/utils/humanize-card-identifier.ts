const PITCH_SUFFIX = /-(red|yellow|blue)$/;
const SMALL_WORDS: ReadonlySet<string> = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);

/**
 * A readable name for a card the page only knows by identifier, such as the
 * original of a replacement (the deck detail carries no name for it): drops the
 * pitch suffix and capitalizes the words, so `emissary-of-tides-red` reads
 * `Emissary of Tides`. Punctuation the identifier lost, like an apostrophe, is
 * not restored.
 */
export function humanizeCardIdentifier(cardIdentifier: string): string {
  return cardIdentifier
    .replace(PITCH_SUFFIX, '')
    .split('-')
    .filter((word) => word.length > 0)
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word) ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`,
    )
    .join(' ');
}
