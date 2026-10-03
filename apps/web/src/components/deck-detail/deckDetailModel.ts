import type { ISwapsSearch } from '../../routes/_auth/-swaps.helpers';
import type {
  IBreakdown,
  IBreakdownEntry,
  ISubstitutedEntry,
  TPath,
} from '../../api/deck-detail';
import { findSwap } from '../../api/swaps';
import type { ISwapMatchKey, TSwapStatus } from '../../api/swaps';

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
  readonly swaps: readonly IDeckSwap[];
}

export interface IDeckSwap extends ISwapMatchKey {
  readonly status: TSwapStatus;
}

export function entryKey(entry: IBreakdownEntry): string {
  return `${entry.cardIdentifier}::${entry.slot}`;
}

export function swapKeyOf(entry: ISubstitutedEntry): ISwapMatchKey {
  return {
    cardIdentifier: entry.original.cardIdentifier,
    slot: entry.original.slot,
    substituteIdentifier: entry.match.substitute.cardIdentifier,
  };
}

export function swapDecision(
  entry: ISubstitutedEntry,
  swaps: readonly IDeckSwap[],
): TSwapDecision {
  const status = findSwap(swaps, swapKeyOf(entry))?.status;
  if (status === 'approved' || status === 'rejected') return status;
  // Until the swaps list has loaded, the engine's own flag keeps an applied swap from reading as pending.
  if (status === undefined && entry.approved === true) return 'approved';
  return 'pending';
}

function sumQuantity(entries: readonly { readonly quantity: number }[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0);
}

function originalKeysWithDecision(
  breakdown: IBreakdown,
  swaps: readonly IDeckSwap[],
  wanted: TSwapDecision,
): ReadonlySet<string> {
  return new Set(
    breakdown.substituted
      .filter((entry) => swapDecision(entry, swaps) === wanted)
      .map((entry) => entryKey(entry.original)),
  );
}

export function summariseDeck({ pct, path, breakdown, swaps }: ISummaryInput): IDeckSummary {
  const notOwned = breakdown.notOwned ?? breakdown.missing;
  const approvedKeys = originalKeysWithDecision(breakdown, swaps, 'approved');
  const pendingKeys = originalKeysWithDecision(breakdown, swaps, 'pending');
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
