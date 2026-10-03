import type { ISwapsSearch } from '../../routes/_auth/-swaps.helpers';
import type {
  IBreakdown,
  IBreakdownEntry,
  IDecisionEntry,
  ISubstitutedEntry,
  TPath,
} from '../../api/deck-detail';

export type TSwapDecision = 'pending' | 'approved' | 'rejected';

export type TStripKind = 'complete' | 'solvable' | 'incomplete';

export interface IDeckSummary {
  readonly kind: TStripKind;
  /** Cards still to acquire: not owned and not covered by an approved swap. */
  readonly missingCards: number;
  readonly missingSlots: number;
  /** Open gaps that no pending or approved swap addresses. */
  readonly unsolvedCards: number;
  readonly pendingSwaps: number;
  readonly approvedSwaps: number;
  readonly openMissing: readonly IBreakdownEntry[];
}

interface ISummaryInput {
  readonly pct: number;
  readonly path: TPath;
  readonly breakdown: IBreakdown;
  readonly decisions: readonly IDecisionEntry[];
}

export function entryKey(entry: IBreakdownEntry): string {
  return `${entry.cardIdentifier}::${entry.slot}`;
}

export function resolveSwapDecision(
  decisions: readonly IDecisionEntry[],
  substituteIdentifier: string,
): TSwapDecision {
  return decisions.find((d) => d.cardIdentifier === substituteIdentifier)?.decision ?? 'pending';
}

export function swapDecision(
  entry: ISubstitutedEntry,
  decisions: readonly IDecisionEntry[],
): TSwapDecision {
  return resolveSwapDecision(decisions, entry.match.substitute.cardIdentifier);
}

function sumQuantity(entries: readonly { readonly quantity: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

function originalKeysWithDecision(
  breakdown: IBreakdown,
  decisions: readonly IDecisionEntry[],
  wanted: TSwapDecision,
): ReadonlySet<string> {
  return new Set(
    breakdown.substituted
      .filter((entry) => swapDecision(entry, decisions) === wanted)
      .map((entry) => entryKey(entry.original)),
  );
}

export function summariseDeck({ pct, path, breakdown, decisions }: ISummaryInput): IDeckSummary {
  const notOwned = breakdown.notOwned ?? breakdown.missing;
  const approvedKeys = originalKeysWithDecision(breakdown, decisions, 'approved');
  const pendingKeys = originalKeysWithDecision(breakdown, decisions, 'pending');
  const openMissing = notOwned.filter((entry) => !approvedKeys.has(entryKey(entry)));
  const unsolved = openMissing.filter((entry) => !pendingKeys.has(entryKey(entry)));
  const pendingSwaps = pendingKeys.size;
  const approvedSwaps = approvedKeys.size;

  const kind: TStripKind =
    pct >= 100 ? 'complete' : path !== 'C' && pendingSwaps > 0 ? 'solvable' : 'incomplete';

  return {
    kind,
    missingCards: sumQuantity(openMissing),
    missingSlots: openMissing.length,
    unsolvedCards: sumQuantity(unsolved),
    pendingSwaps,
    approvedSwaps,
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

export const SWAPS_LINK_SEARCH: ISwapsSearch = {
  state: 'pending',
  tier: [],
  deck: [],
  hero: [],
  confidenceMin: 0,
  confidenceMax: 100,
};
