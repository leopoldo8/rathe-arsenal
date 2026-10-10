function wordsOf(text: string | undefined): Set<string> {
  const stripped = (text ?? '')
    .toLowerCase()
    .replace(/\{[a-z]\}/g, ' ');
  return new Set(stripped.match(/[a-z0-9]+/g) ?? []);
}

/** Share of distinct words two rules texts have in common (Jaccard), ignoring case, punctuation and resource symbols. */
export function rulesTextSimilarity(a: string | undefined, b: string | undefined): number {
  const left = wordsOf(a);
  const right = wordsOf(b);
  const shared = [...left].filter((word) => right.has(word)).length;
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}
