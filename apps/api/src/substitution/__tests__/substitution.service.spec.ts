import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { SubstitutionService } from '../substitution.service';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../auth/authz.service';
import { CollectionReadService } from '../../collection/collection-read.service';

// Mock the engine module to avoid loading the full catalog in unit tests
jest.mock('@rathe-arsenal/engine', () => ({
  catalog: {
    cards: [],
    indices: {
      byIdentifier: new Map(),
      byClassAndPitch: new Map(),
      byTypeAndClass: new Map(),
    },
    getCard: jest.fn(),
    getRawCard: jest.fn(),
  },
  computeEffectiveReadiness: jest.fn().mockReturnValue({
    rawPercent: 0.8,
    effectivePercent: 0.95,
    path: 'C',
    fidelityPercent: 75.6666,
    breakdown: {
      exact: [{ cardIdentifier: 'card-a', quantity: 3, slot: 'mainboard' }],
      substituted: [],
      missing: [{ cardIdentifier: 'card-b', quantity: 1, slot: 'mainboard' }],
    },
    substitutions: [],
    pitchCurve: {
      original: { red: 2, yellow: 1, blue: 1, colorless: 0 },
      modified: { red: 2, yellow: 1, blue: 1, colorless: 0 },
    },
  }),
  // Pure helpers called by deriveSnapshotFields -- mock with deterministic
  // implementations so the unit test does not depend on the full engine.
  computePath: jest.fn((breakdown: {
    missing: ReadonlyArray<unknown>;
    substituted: ReadonlyArray<unknown>;
  }) => {
    if (breakdown.missing.length > 0) return 'C';
    if (breakdown.substituted.length > 0) return 'B';
    return 'A';
  }),
  computeFidelity: jest.fn(
    (
      breakdown: {
        exact: ReadonlyArray<{ quantity: number }>;
        substituted: ReadonlyArray<{
          original: { quantity: number };
          match: { tier: 1 | 2 };
        }>;
      },
      totalCards: number,
    ) => {
      if (totalCards <= 0) return 0;
      let weighted = 0;
      for (const e of breakdown.exact) weighted += e.quantity;
      for (const s of breakdown.substituted) {
        const weight = s.match.tier === 1 ? 0.9 : 0.7;
        weighted += weight * s.original.quantity;
      }
      return (weighted / totalCards) * 100;
    },
  ),
}));

describe('SubstitutionService', () => {
  let service: SubstitutionService;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let authzService: jest.Mocked<AuthzService>;
  let collectionReadService: jest.Mocked<CollectionReadService>;

  beforeEach(async () => {
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    authzService = createMock<AuthzService>();
    collectionReadService = createMock<CollectionReadService>();

    // Default: empty collection (no owned cards).
    collectionReadService.loadOwned.mockResolvedValue(new Map());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubstitutionService,
        { provide: getRepositoryToken(TrackedDeckEntity), useValue: trackedDeckRepo },
        { provide: getRepositoryToken(DeckCardEntity), useValue: deckCardRepo },
        { provide: getRepositoryToken(DeckReadinessSnapshotEntity), useValue: snapshotRepo },
        { provide: AuthzService, useValue: authzService },
        { provide: CollectionReadService, useValue: collectionReadService },
      ],
    }).compile();

    service = module.get<SubstitutionService>(SubstitutionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calls authz before computing readiness', async () => {
    // Arrange
    const trackedDeckId = 1;
    const userId = 'user-123';

    trackedDeckRepo.findOne.mockResolvedValue({
      id: trackedDeckId,
      userId,
      fabraryUlid: 'abc',
      name: 'Test Deck',
      hero: 'dorinthea',
      format: 'classic-constructed',
      trackedAt: new Date(),
    } as TrackedDeckEntity);

    deckCardRepo.find.mockResolvedValue([
      { id: 1, trackedDeckId, cardIdentifier: 'card-a', quantity: 3, slot: 'mainboard' } as DeckCardEntity,
    ]);

    collectionReadService.loadOwned.mockResolvedValue(
      new Map([['card-a', 3]]),
    );

    const savedSnapshot = {
      id: 1,
      trackedDeckId,
      rawPercent: 0.8,
      effectivePercent: 0.95,
      breakdown: {},
      substitutions: {},
      computedAt: new Date(),
    } as DeckReadinessSnapshotEntity;

    snapshotRepo.create.mockReturnValue(savedSnapshot);
    snapshotRepo.save.mockResolvedValue(savedSnapshot);

    // Act
    const result = await service.computeAndStoreReadiness(trackedDeckId, userId);

    // Assert
    expect(authzService.assertOwnsTrackedDeck).toHaveBeenCalledWith(userId, trackedDeckId);
    expect(result).toBeDefined();
    expect(result.rawPercent).toBe(0.8);
    expect(snapshotRepo.save).toHaveBeenCalled();
  });

  it('throws NotFoundException when deck does not exist', async () => {
    // Arrange
    trackedDeckRepo.findOne.mockResolvedValue(null);

    // Act & Assert
    await expect(
      service.computeAndStoreReadiness(999, 'user-123'),
    ).rejects.toThrow(NotFoundException);
  });

  it('persists a snapshot with correct readiness data', async () => {
    // Arrange
    const trackedDeckId = 42;
    const userId = 'user-456';

    trackedDeckRepo.findOne.mockResolvedValue({
      id: trackedDeckId,
      userId,
    } as TrackedDeckEntity);

    deckCardRepo.find.mockResolvedValue([]);
    collectionReadService.loadOwned.mockResolvedValue(new Map());

    const savedSnapshot = {
      id: 10,
      trackedDeckId,
      rawPercent: 0.8,
      effectivePercent: 0.95,
      breakdown: {},
      substitutions: {},
      computedAt: new Date(),
    } as DeckReadinessSnapshotEntity;

    snapshotRepo.create.mockReturnValue(savedSnapshot);
    snapshotRepo.save.mockResolvedValue(savedSnapshot);

    // Act
    const result = await service.computeAndStoreReadiness(trackedDeckId, userId);

    // Assert
    expect(snapshotRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        trackedDeckId,
        rawPercent: 0.8,
        effectivePercent: 0.95,
      }),
    );
    expect(result.id).toBe(10);
  });

  it('builds inventory map from collection cards', async () => {
    // Arrange
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- mocked module needs runtime access to the jest.fn instance
    const { computeEffectiveReadiness } = require('@rathe-arsenal/engine');
    const trackedDeckId = 1;
    const userId = 'user-789';

    trackedDeckRepo.findOne.mockResolvedValue({
      id: trackedDeckId,
      userId,
    } as TrackedDeckEntity);

    deckCardRepo.find.mockResolvedValue([
      { id: 1, trackedDeckId, cardIdentifier: 'card-x', quantity: 2, slot: 'mainboard' } as DeckCardEntity,
    ]);

    collectionReadService.loadOwned.mockResolvedValue(
      new Map([['card-x', 4], ['card-y', 1]]),
    );

    snapshotRepo.create.mockReturnValue({} as DeckReadinessSnapshotEntity);
    snapshotRepo.save.mockResolvedValue({} as DeckReadinessSnapshotEntity);

    // Act
    await service.computeAndStoreReadiness(trackedDeckId, userId);

    // Assert
    expect(computeEffectiveReadiness).toHaveBeenCalledWith(
      expect.objectContaining({
        cards: [{ cardIdentifier: 'card-x', quantity: 2, slot: 'mainboard' }],
      }),
      expect.any(Map),
      expect.anything(),
      undefined,
      expect.any(Set),
    );

    // Verify the inventory map passed to the engine
    const inventoryArg = computeEffectiveReadiness.mock.calls[0][1] as Map<string, number>;
    expect(inventoryArg.get('card-x')).toBe(4);
    expect(inventoryArg.get('card-y')).toBe(1);
  });

  describe('deriveSnapshotFields', () => {
    it('derives Path A and 100% fidelity for an all-exact snapshot', () => {
      // Arrange
      const snapshot = {
        id: 1,
        breakdown: {
          exact: [{ cardIdentifier: 'card-a', quantity: 60, slot: 'mainboard' }],
          substituted: [],
          missing: [],
        },
      } as unknown as DeckReadinessSnapshotEntity;

      // Act
      const result = service.deriveSnapshotFields(snapshot, 60);

      // Assert
      expect(result.path).toBe('A');
      expect(result.fidelityPercent).toBe(100);
    });

    it('derives Path B and weighted fidelity when substitutions cover missing', () => {
      // Arrange
      const snapshot = {
        id: 2,
        breakdown: {
          exact: [{ cardIdentifier: 'card-a', quantity: 2, slot: 'mainboard' }],
          substituted: [
            {
              original: { cardIdentifier: 'card-b', quantity: 1, slot: 'mainboard' },
              match: { tier: 1 },
            },
          ],
          missing: [],
        },
      } as unknown as DeckReadinessSnapshotEntity;

      // Act
      const result = service.deriveSnapshotFields(snapshot, 3);

      // Assert
      expect(result.path).toBe('B');
      // (2 * 1.0 + 1 * 0.9) / 3 * 100 = 96.666...
      expect(result.fidelityPercent).toBeCloseTo(96.6666, 3);
    });

    it('derives Path C and tier-weighted fidelity for a legacy-shaped snapshot', () => {
      // Arrange -- mimics a legacy snapshot with no `path` / `fidelityPercent` persisted.
      const snapshot = {
        id: 3,
        breakdown: {
          exact: [{ cardIdentifier: 'card-a', quantity: 40, slot: 'mainboard' }],
          substituted: [
            {
              original: { cardIdentifier: 'card-b', quantity: 3, slot: 'mainboard' },
              match: { tier: 1 },
            },
            {
              original: { cardIdentifier: 'card-c', quantity: 3, slot: 'mainboard' },
              match: { tier: 2 },
            },
          ],
          missing: [{ cardIdentifier: 'card-d', quantity: 14, slot: 'mainboard' }],
        },
      } as unknown as DeckReadinessSnapshotEntity;

      // Act
      const result = service.deriveSnapshotFields(snapshot, 60);

      // Assert
      expect(result.path).toBe('C');
      // (40 + 3 * 0.9 + 3 * 0.7) / 60 * 100 = (40 + 2.7 + 2.1) / 60 * 100 = 74.666...
      expect(result.fidelityPercent).toBeCloseTo(74.6666, 3);
    });

    it('returns 0 fidelity when totalCards is 0', () => {
      // Arrange
      const snapshot = {
        id: 4,
        breakdown: {
          exact: [],
          substituted: [],
          missing: [],
        },
      } as unknown as DeckReadinessSnapshotEntity;

      // Act
      const result = service.deriveSnapshotFields(snapshot, 0);

      // Assert
      expect(result.fidelityPercent).toBe(0);
      expect(Number.isNaN(result.fidelityPercent)).toBe(false);
    });
  });
});
