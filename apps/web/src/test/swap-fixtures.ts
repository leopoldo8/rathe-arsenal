import type { ISwapRow } from '../api/swaps';

let sequence = 0;

export function makeSwapRow(overrides: Partial<ISwapRow> = {}): ISwapRow {
  sequence += 1;
  return {
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    trackedDeckId: 1,
    deckName: 'Dromai Storm',
    hero: 'Dromai',
    cardIdentifier: `original-${sequence}`,
    originalName: `Original ${sequence}`,
    slot: 'mainboard',
    substituteIdentifier: `substitute-${sequence}`,
    substituteName: `Substitute ${sequence}`,
    quantity: 1,
    ownedCount: 3,
    tier: 1,
    confidence: 92,
    rationale: 'Same pitch and cost.',
    status: 'pending',
    appliedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    rejectionNote: null,
    outcome: null,
    originalImageUrl: null,
    substituteImageUrl: null,
    originalPitch: 1,
    substitutePitch: 1,
    originalType: 'Action',
    substituteType: 'Action',
    ...overrides,
  };
}
