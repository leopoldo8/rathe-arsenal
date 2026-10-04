import { createMock } from '@golevelup/ts-jest';
import { ICatalogCard } from '@rathe-arsenal/engine';
import { CatalogService } from '../../catalog/catalog.service';
import { SwapSuggestionEntity } from '../../database/entities/swap-suggestion.entity';
import { buildSwapRow } from '../build-swap-row';

const IMAGE = {
  small: 'https://img/small.webp',
  large: 'https://img/large.webp',
  sources: [{ small: 'https://mirror/small.webp', large: 'https://mirror/large.webp' }],
};

interface ICardOverrides {
  readonly cardIdentifier?: string;
  readonly name?: string;
  readonly pitch?: number | null;
  readonly types?: readonly string[];
  readonly imageUrl?: ICatalogCard['imageUrl'];
  readonly classes?: readonly string[];
  readonly keywords?: readonly string[];
  readonly power?: number | null;
  readonly defense?: number | null;
}

function makeCard(overrides: ICardOverrides): ICatalogCard {
  return {
    cardIdentifier: 'card',
    name: 'Card',
    pitch: 1,
    types: ['Action'],
    imageUrl: null,
    classes: ['Generic'],
    keywords: [],
    power: 3,
    defense: 2,
    ...overrides,
  } as unknown as ICatalogCard;
}

function makeEntity(overrides: Partial<SwapSuggestionEntity> = {}): SwapSuggestionEntity {
  return {
    id: '7b3f6a52-3d0e-4d4f-9a59-1b2f7c1d9e10',
    userId: 'user-1',
    trackedDeckId: 42,
    cardIdentifier: 'emissary-of-tides-red',
    slot: 'mainboard',
    substituteIdentifier: 'coax-a-commotion-red',
    quantity: 2,
    tier: 1,
    confidence: 100,
    rationale: 'Same profile',
    status: 'approved',
    appliedAt: new Date('2026-10-01T10:00:00.000Z'),
    rejectedAt: null,
    rejectionReason: null,
    rejectionNote: null,
    outcome: 'worked',
    ...overrides,
  } as SwapSuggestionEntity;
}

describe('buildSwapRow', () => {
  const catalogService = createMock<CatalogService>();

  beforeEach(() => {
    catalogService.getCard.mockImplementation((identifier: string) => {
      if (identifier === 'emissary-of-tides-red') {
        return makeCard({ cardIdentifier: identifier, name: 'Emissary of Tides', pitch: 1, imageUrl: IMAGE });
      }
      if (identifier === 'coax-a-commotion-red') {
        return makeCard({ cardIdentifier: identifier, name: 'Coax a Commotion', pitch: 1, types: ['Action', 'Attack'] });
      }
      throw new Error('not found');
    });
  });

  it('maps every lifecycle field, the deck meta and the live owned count', () => {
    const row = buildSwapRow({
      entity: makeEntity(),
      deck: { name: 'Katsu Aggro', hero: 'katsu-the-wanderer' },
      inventory: new Map([['coax-a-commotion-red', 3]]),
      catalogService,
    });

    expect(row).toEqual({
      id: '7b3f6a52-3d0e-4d4f-9a59-1b2f7c1d9e10',
      trackedDeckId: 42,
      deckName: 'Katsu Aggro',
      hero: 'katsu-the-wanderer',
      cardIdentifier: 'emissary-of-tides-red',
      originalName: 'Emissary of Tides',
      slot: 'mainboard',
      substituteIdentifier: 'coax-a-commotion-red',
      substituteName: 'Coax a Commotion',
      quantity: 2,
      ownedCount: 3,
      tier: 1,
      confidence: 100,
      rationale: 'Same profile',
      status: 'approved',
      appliedAt: '2026-10-01T10:00:00.000Z',
      rejectedAt: null,
      rejectionReason: null,
      rejectionNote: null,
      outcome: 'worked',
      originalImageUrl: IMAGE,
      substituteImageUrl: null,
      originalPitch: 1,
      substitutePitch: 1,
      originalType: 'Action',
      substituteType: 'Action',
      rationaleDetail: {
        tier: 1,
        pitch: 'red',
        sharedClasses: ['Generic'],
        powerDelta: 0,
        defenseDelta: 0,
        sharedKeywords: [],
      },
    });
  });

  it('has no rationale detail when either card is missing from the catalog', () => {
    const row = buildSwapRow({
      entity: makeEntity({ substituteIdentifier: 'unknown-card' }),
      deck: { name: 'Deck', hero: 'hero' },
      inventory: new Map(),
      catalogService,
    });

    expect(row.rationaleDetail).toBeNull();
  });

  it('reports zero owned copies instead of omitting a substitute the user no longer has', () => {
    const row = buildSwapRow({
      entity: makeEntity({ status: 'pending', appliedAt: null, outcome: null }),
      deck: { name: 'Deck', hero: 'hero' },
      inventory: new Map(),
      catalogService,
    });

    expect(row.ownedCount).toBe(0);
  });

  it('serializes rejection fields for a rejected row', () => {
    const row = buildSwapRow({
      entity: makeEntity({
        status: 'rejected',
        appliedAt: null,
        outcome: null,
        rejectedAt: new Date('2026-10-02T09:30:00.000Z'),
        rejectionReason: 'dont_own',
        rejectionNote: 'sold them',
      }),
      deck: { name: 'Deck', hero: 'hero' },
      inventory: new Map(),
      catalogService,
    });

    expect(row.rejectedAt).toBe('2026-10-02T09:30:00.000Z');
    expect(row.rejectionReason).toBe('dont_own');
    expect(row.rejectionNote).toBe('sold them');
  });

  it('falls back to the identifier when a card is missing from the catalog', () => {
    const row = buildSwapRow({
      entity: makeEntity({ substituteIdentifier: 'unknown-card' }),
      deck: { name: 'Deck', hero: 'hero' },
      inventory: new Map(),
      catalogService,
    });

    expect(row.substituteName).toBe('unknown-card');
    expect(row.substitutePitch).toBeNull();
    expect(row.substituteType).toBe('unknown');
    expect(row.substituteImageUrl).toBeNull();
  });

  it('narrows an out-of-domain pitch to null', () => {
    catalogService.getCard.mockReturnValue(makeCard({ pitch: 0 }));

    const row = buildSwapRow({
      entity: makeEntity(),
      deck: { name: 'Deck', hero: 'hero' },
      inventory: new Map(),
      catalogService,
    });

    expect(row.originalPitch).toBeNull();
  });
});
