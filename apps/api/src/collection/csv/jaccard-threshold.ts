/**
 * Minimum Jaccard similarity score required to classify an incoming CSV as a
 * "partial overlap" of an existing source rather than "new".
 *
 * A value of 0.5 means the incoming card-identifier set must share at least
 * half of the union with the existing set. Boundary is inclusive: exactly 0.5
 * is classified as partial-overlap, not new.
 */
export const JACCARD_THRESHOLD = 0.5;
