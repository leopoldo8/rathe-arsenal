/**
 * Pre-implementation spike findings (D4):
 *
 * - @flesh-and-blood/cards v3.6.243 has 4595 cards total.
 * - NO `byName` index exists in the catalog. The `ICatalogIndices` type exposes
 *   `byIdentifier` (Map<string, ICatalogCard>), `byClassAndPitch`, and `byTypeAndClass`.
 *   The kebab transform is necessary.
 * - Pitch encoding in identifiers: pitch 1 = 'red', pitch 2 = 'yellow', pitch 3 = 'blue'.
 *   ALL pitched cards have the color suffix (zero pitched cards without it).
 * - Kebab transform rules validated:
 *     1. Lowercase
 *     2. Strip commas, apostrophes, periods, exclamation marks, question marks
 *     3. Replace whitespace runs with single hyphens
 *     4. Collapse consecutive hyphens
 *     5. Trim leading / trailing hyphens
 *   Confirmed against real identifiers: 'A Drop in the Ocean' -> 'a-drop-in-the-ocean',
 *   'Autumn's Touch' -> 'autumns-touch', '10,000 Year Reunion' -> '10000-year-reunion',
 *   'Argh... Smash!' -> 'argh-smash'.
 * - No byName index → alias table cannot be replaced by a constants file alone.
 * - Cúpula DT product name language: Gate 3c examples are English (confirmed with catalog).
 *   PT-BR translation risk deferred to alias table population after Unit 7 accuracy run.
 */

/**
 * Known foil and variant suffixes that appear in store product names but
 * are not part of the canonical card identifier. Matched case-insensitively.
 *
 * The list grows only from observed unmatched logs (see Unit 7 accuracy
 * verification run). Order matters: strip longer / more specific suffixes
 * before shorter ones.
 */
export const STRIPPABLE_SUFFIXES: readonly string[] = [
  '(Cold Foil)',
  '(Rainbow Foil)',
  '(Foil)',
  '(Extended Art)',
  '(Alternate Art)',
];

/**
 * Pitch color labels as they appear in store product names, mapped to the
 * identifier suffix used in @flesh-and-blood/cards.
 *
 * Pitch 1 = Red, 2 = Yellow, 3 = Blue.
 * The label must match exactly (case-insensitive) at the end of the name
 * after stripping foil suffixes.
 */
export const PITCH_COLOR_MAP: Readonly<Record<string, string>> = {
  '(Red)': 'red',
  '(Yellow)': 'yellow',
  '(Blue)': 'blue',
};

/**
 * Regex that matches a leading quantity prefix like "5 " or "12 " at the
 * start of a store product name. Cúpula DT occasionally renders the available
 * stock count inline with the product name (e.g. "5 Copper" means "Copper, qty 5").
 * The prefix is stripped before the kebab transform.
 */
export const LEADING_QUANTITY_RE = /^\d+\s+/;

/**
 * Maximum length (characters) of a raw name before truncation in warn logs.
 * Protects against log-injection via an oversized store product name.
 */
export const RAW_NAME_MAX_LOG_LENGTH = 200;

/**
 * Control-character regex used to sanitize rawName before emitting it to
 * structured logs. Belt-and-suspenders — pino already JSON-escapes, but
 * we strip to prevent layout-breaking characters in log viewers.
 */
export const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/g;
