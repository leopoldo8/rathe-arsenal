/** The panel shows the first ranks; a staple the deck lacks is the strongest upgrade there is, so it must appear there. */
export const EVAL_TOP_N = 10;
/** Ranks also reported, to tell "ranked a bit low" from "not ranked at all". */
export const EVAL_REPORTED_CUTOFFS = [5, 10, 25] as const;

export interface IRunScore {
  /** Rank of each expected card in the model's list (1 is best), or null when the model did not rank it. */
  readonly ranks: Readonly<Record<string, number | null>>;
  /** Expected cards ranked within the top N. */
  readonly hits: number;
}

export interface ICardSummary {
  readonly cardIdentifier: string;
  readonly runs: number;
  /** Share of runs that ranked the card within each reported cutoff. */
  readonly hitRate: Readonly<Record<number, number>>;
  /** The best rank that at least half the runs reach (an unranked run counts as worse than any rank); null when fewer than half rank it. */
  readonly medianRank: number | null;
  readonly ranks: readonly (number | null)[];
}

/**
 * The model's picks in order, as the production list would hold them: unknown or out-of-pool identifiers and repeats are
 * dropped, but nothing is cut, so a card ranked 11th to 25th is still seen.
 */
export function rankedPicks(entries: readonly { readonly card: string }[], pool: ReadonlySet<string>): string[] {
  const picks: string[] = [];
  for (const entry of entries) {
    if (pool.has(entry.card) && !picks.includes(entry.card)) picks.push(entry.card);
  }
  return picks;
}

export function scoreRun(expected: readonly string[], picks: readonly string[], topN: number = EVAL_TOP_N): IRunScore {
  const ranks = Object.fromEntries(expected.map((cardIdentifier) => {
    const index = picks.indexOf(cardIdentifier);
    return [cardIdentifier, index < 0 ? null : index + 1];
  }));
  const hits = expected.filter((cardIdentifier) => ranks[cardIdentifier] !== null && ranks[cardIdentifier]! <= topN).length;
  return { ranks, hits };
}

function median(ranks: readonly (number | null)[]): number | null {
  const sorted = ranks.map((rank) => rank ?? Number.POSITIVE_INFINITY).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const middle = sorted[Math.floor((sorted.length - 1) / 2)]!;
  return Number.isFinite(middle) ? middle : null;
}

export function summarizeCard(cardIdentifier: string, scores: readonly IRunScore[]): ICardSummary {
  const ranks = scores.map((score) => score.ranks[cardIdentifier] ?? null);
  const hitRate = Object.fromEntries(
    EVAL_REPORTED_CUTOFFS.map((cutoff) => [cutoff, ranks.length === 0 ? 0 : ranks.filter((rank) => rank !== null && rank <= cutoff).length / ranks.length]),
  );
  return { cardIdentifier, runs: ranks.length, hitRate, medianRank: median(ranks), ranks };
}
