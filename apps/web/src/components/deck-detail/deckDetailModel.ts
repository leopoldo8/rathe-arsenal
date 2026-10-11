import type { IBreakdown, IBreakdownEntry, ISubstitutedEntry } from '../../api/deck-detail';
import type { IDeckReplacement } from '../../api/replacements';

export type TStripKind = 'complete' | 'suggestions' | 'incomplete';

export interface IDeckSummary {
  readonly kind: TStripKind;
  /** Copies the collection does not cover exactly. */
  readonly missingCards: number;
  /** Missing rows whose card the collection can stand in for. */
  readonly suggestionCount: number;
  readonly openMissing: readonly IBreakdownEntry[];
}

interface ISummaryInput {
  readonly pct: number;
  readonly breakdown: IBreakdown;
  readonly replacements: readonly IDeckReplacement[];
}

export function entryKey(entry: Pick<IBreakdownEntry, 'cardIdentifier' | 'slot'>): string {
  return `${entry.cardIdentifier}::${entry.slot}`;
}

function heldCopies(entry: IBreakdownEntry, replacements: readonly IDeckReplacement[]): number {
  return replacements
    .filter((replacement) => replacement.replacementCardIdentifier === entry.cardIdentifier && replacement.slot === entry.slot)
    .reduce((sum, replacement) => sum + replacement.quantity, 0);
}

/** The suggestion of each missing row, keyed by `entryKey`: the first stand-in the engine found for that card and slot. */
export function findSuggestions(
  breakdown: IBreakdown,
  replacements: readonly IDeckReplacement[],
): ReadonlyMap<string, ISubstitutedEntry> {
  const firstByKey = new Map<string, ISubstitutedEntry>();
  for (const entry of breakdown.substituted) {
    const key = entryKey(entry.original);
    if (!firstByKey.has(key)) firstByKey.set(key, entry);
  }
  const suggestions = new Map<string, ISubstitutedEntry>();
  for (const entry of breakdown.notOwned ?? breakdown.missing) {
    const suggestion = firstByKey.get(entryKey(entry));
    if (suggestion !== undefined && entry.quantity > heldCopies(entry, replacements)) {
      suggestions.set(entryKey(entry), suggestion);
    }
  }
  return suggestions;
}

export function summariseDeck({ pct, breakdown, replacements }: ISummaryInput): IDeckSummary {
  const openMissing = breakdown.notOwned ?? breakdown.missing;
  const suggestionCount = findSuggestions(breakdown, replacements).size;
  const kind: TStripKind = pct >= 100 ? 'complete' : suggestionCount > 0 ? 'suggestions' : 'incomplete';
  return {
    kind,
    missingCards: openMissing.reduce((sum, entry) => sum + entry.quantity, 0),
    suggestionCount,
    openMissing,
  };
}

export type TScoreBand = 'high' | 'mid' | 'low';

export const SCORE_BAND_HIGH_FLOOR = 90;
export const SCORE_BAND_MID_FLOOR = 70;

export function resolveScoreBand(scorePercent: number): TScoreBand {
  if (scorePercent >= SCORE_BAND_HIGH_FLOOR) return 'high';
  if (scorePercent >= SCORE_BAND_MID_FLOOR) return 'mid';
  return 'low';
}
