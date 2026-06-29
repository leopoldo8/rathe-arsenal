/**
 * Source label de-duplication.
 *
 * When a user creates a new library source — whether by CSV upload or by
 * Fabrary import — whose label collides with one they already have, we
 * disambiguate by prefixing an occurrence counter: the first keeps its
 * plain name, the second becomes "#2 {name}", the third "#3 {name}", and so
 * on.
 *
 * The next counter is derived from the highest existing occurrence in the
 * family rather than the family size, so deleting an earlier occurrence can
 * never produce a label that collides with a surviving one.
 */

const LABEL_PREFIX_PATTERN = /^#(\d+)\s+(.+)$/;

export interface IParsedSourceLabel {
  /** Occurrence number. A plain label (no counter prefix) is occurrence 1. */
  readonly index: number;
  /** The label with any generated "#N " prefix stripped. */
  readonly base: string;
}

/**
 * Splits a label into its occurrence index and base name. Only counter
 * prefixes we generate (`#2`, `#3`, …) are stripped; a `#1` prefix or any
 * other leading `#` content is left as part of the base so user-supplied
 * names are never mangled.
 *
 *   "My Deck"     -> { index: 1, base: "My Deck" }
 *   "#3 My Deck"  -> { index: 3, base: "My Deck" }
 */
export function parseSourceLabel(label: string): IParsedSourceLabel {
  const match = LABEL_PREFIX_PATTERN.exec(label);
  const counter = match?.[1];
  const base = match?.[2];
  if (counter === undefined || base === undefined) {
    return { index: 1, base: label };
  }

  const index = Number.parseInt(counter, 10);
  if (!Number.isFinite(index) || index < 2) {
    return { index: 1, base: label };
  }

  return { index, base };
}

/**
 * Returns the label to assign to a new source with the desired `baseLabel`,
 * given every existing source label for the user. Yields the plain
 * `baseLabel` when there is no collision, or `"#{n} {baseLabel}"` where `n`
 * is one past the highest existing occurrence in that family.
 */
export function nextDedupedLabel(
  baseLabel: string,
  existingLabels: readonly string[],
): string {
  let maxIndex = 0;

  for (const existing of existingLabels) {
    const parsed = parseSourceLabel(existing);
    if (parsed.base === baseLabel) {
      maxIndex = Math.max(maxIndex, parsed.index);
    }
  }

  if (maxIndex === 0) {
    return baseLabel;
  }

  return `#${maxIndex + 1} ${baseLabel}`;
}
