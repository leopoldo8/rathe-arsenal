import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { SubstitutionService } from '../substitution.service';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../auth/authz.service';

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
}));

describe('SubstitutionService', () => {
  let service: SubstitutionService;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let collectionCardRepo: jest.Mocked<Repository<CollectionCardEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let authzService: jest.Mocked<AuthzService>;

  beforeEach(async () => {
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    collectionCardRepo = createMock<Repository<CollectionCardEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    authzService = createMock<AuthzService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubstitutionService,
        { provide: getRepositoryToken(TrackedDeckEntity), useValue: trackedDeckRepo },
        { provide: getRepositoryToken(DeckCardEntity), useValue: deckCardRepo },
        { provide: getRepositoryToken(CollectionCardEntity), useValue: collectionCardRepo },
        { provide: getRepositoryToken(DeckReadinessSnapshotEntity), useValue: snapshotRepo },
        { provide: AuthzService, useValue: authzService },
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

    collectionCardRepo.find.mockResolvedValue([
      { id: 1, userId, cardIdentifier: 'card-a', quantity: 3, lastUpdated: new Date() } as CollectionCardEntity,
    ]);

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
    collectionCardRepo.find.mockResolvedValue([]);

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

    collectionCardRepo.find.mockResolvedValue([
      { id: 1, userId, cardIdentifier: 'card-x', quantity: 4, lastUpdated: new Date() } as CollectionCardEntity,
      { id: 2, userId, cardIdentifier: 'card-y', quantity: 1, lastUpdated: new Date() } as CollectionCardEntity,
    ]);

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
    );

    // Verify the inventory map passed to the engine
    const inventoryArg = computeEffectiveReadiness.mock.calls[0][1] as Map<string, number>;
    expect(inventoryArg.get('card-x')).toBe(4);
    expect(inventoryArg.get('card-y')).toBe(1);
  });
});
