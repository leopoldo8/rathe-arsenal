import type {
  IBreakdown,
  IBreakdownEntry,
  ISubstitutedEntry,
} from '../../../api/deck-detail';

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
  substitute: { readonly name?: string; readonly pitch?: number | null } = {},
): ISubstitutedEntry {
  return {
    original: entry(original),
    match: {
      substitute: {
        cardIdentifier: substituteId,
        name: substitute.name ?? `Sub ${substituteId}`,
        classes: [],
        pitch: substitute.pitch ?? null,
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
