import type {
  IBreakdown,
  IBreakdownEntry,
  ISubstitutedEntry,
} from '../../../api/deck-detail';
import type { TSwapStatus } from '../../../api/swaps';
import type { IDeckSwap } from '../deckDetailModel';

export function entry(overrides: Partial<IBreakdownEntry> = {}): IBreakdownEntry {
  return {
    cardIdentifier: 'card-a',
    name: 'Card A',
    quantity: 1,
    slot: 'mainboard',
    pitch: 1,
    cost: 1,
    type: 'Action',
    imageUrl: null,
    ...overrides,
  };
}

export function swap(
  original: Partial<IBreakdownEntry>,
  substituteId: string,
  score = 0.92,
): ISubstitutedEntry {
  return {
    original: entry(original),
    match: {
      substitute: {
        cardIdentifier: substituteId,
        name: `Sub ${substituteId}`,
        classes: [],
        pitch: null,
        power: null,
        defense: null,
        keywords: [],
        imageUrl: null,
      },
      tier: 1,
      score,
      rationale: '',
    },
  };
}

export function breakdown(overrides: Partial<IBreakdown> = {}): IBreakdown {
  const substituted = overrides.substituted ?? [];
  const missing = overrides.missing ?? [];
  return {
    exact: [],
    substituted,
    missing,
    notOwned: overrides.notOwned ?? [...missing, ...substituted.map((s) => s.original)],
    ...overrides,
  };
}

export function deckSwap(
  cardIdentifier: string,
  substituteIdentifier: string,
  status: TSwapStatus,
  slot = 'mainboard',
): IDeckSwap {
  return { cardIdentifier, slot, substituteIdentifier, status };
}

export function storedSwap(
  id: string,
  cardIdentifier: string,
  substituteIdentifier: string,
  quantity: number,
  status: TSwapStatus = 'pending',
): IDeckSwap & { readonly id: string; readonly quantity: number } {
  return { id, quantity, ...deckSwap(cardIdentifier, substituteIdentifier, status) };
}
