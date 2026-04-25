/**
 * Unit tests for SourcesService — list, patch, previewDelete, delete (U9).
 *
 * Pattern: mock all TypeORM repositories + DataSource + downstream services.
 * Every test follows the AAA (Arrange / Act / Assert) pattern.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { DecisionsService } from '../../decks/decisions/decisions.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SourcesService } from '../sources/sources.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-uuid-sources-v2-001';
const OTHER_USER_ID = 'user-uuid-sources-v2-002';
const CSV_SOURCE_ID = 'csv-source-uuid-001';
const MANUAL_SOURCE_ID = 'manual-source-uuid-001';
const DECK_ID = 1;

function buildCsvSource(overrides: Partial<CsvSourceEntity> = {}): CsvSourceEntity {
  return {
    id: CSV_SOURCE_ID,
    userId: USER_ID,
    kind: 'csv',
    label: 'My Collection',
    originalFilename: 'collection.csv',
    sourceUrl: null,
    contentHash: 'abc123',
    cardCount: 10,
    active: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    user: {} as CsvSourceEntity['user'],
    ...overrides,
  };
}

function buildManualSource(overrides: Partial<CsvSourceEntity> = {}): CsvSourceEntity {
  return {
    ...buildCsvSource({ id: MANUAL_SOURCE_ID }),
    kind: 'manual',
    label: 'Manual entries',
    originalFilename: null,
    contentHash: null,
    cardCount: null,
    ...overrides,
  };
}

function buildCard(
  id: number,
  cardIdentifier: string,
  sourceId = CSV_SOURCE_ID,
): CollectionCardEntity {
  return {
    id,
    userId: USER_ID,
    sourceId,
    cardIdentifier,
    quantity: 1,
  } as CollectionCardEntity;
}

function buildDeck(overrides: Partial<TrackedDeckEntity> = {}): TrackedDeckEntity {
  return {
    id: DECK_ID,
    userId: USER_ID,
    fabraryUlid: 'ULID001',
    name: 'Test Deck',
    hero: 'Rhinar',
    format: 'cc',
    trackedAt: new Date('2025-01-01'),
    user: {} as TrackedDeckEntity['user'],
    ...overrides,
  };
}

function buildSnapshot(
  trackedDeckId = DECK_ID,
  effectivePercent = 75,
  substitutions: Record<string, unknown> = {},
): DeckReadinessSnapshotEntity {
  return {
    id: 1,
    trackedDeckId,
    rawPercent: effectivePercent,
    effectivePercent,
    breakdown: {},
    substitutions,
    computedAt: new Date('2025-01-01'),
    trackedDeck: {} as DeckReadinessSnapshotEntity['trackedDeck'],
  };
}

// ---------------------------------------------------------------------------
// Test module setup
// ---------------------------------------------------------------------------

describe('SourcesService — U9 extensions', () => {
  let service: SourcesService;
  let csvSourceRepo: jest.Mocked<Repository<CsvSourceEntity>>;
  let collectionCardRepo: jest.Mocked<Repository<CollectionCardEntity>>;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let dataSource: jest.Mocked<DataSource>;
  let decisionsService: jest.Mocked<DecisionsService>;
  let substitutionService: jest.Mocked<SubstitutionService>;

  beforeEach(async () => {
    csvSourceRepo = createMock<Repository<CsvSourceEntity>>();
    collectionCardRepo = createMock<Repository<CollectionCardEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    dataSource = createMock<DataSource>();
    decisionsService = createMock<DecisionsService>();
    substitutionService = createMock<SubstitutionService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SourcesService,
        { provide: getRepositoryToken(CsvSourceEntity), useValue: csvSourceRepo },
        { provide: getRepositoryToken(CollectionCardEntity), useValue: collectionCardRepo },
        { provide: getRepositoryToken(TrackedDeckEntity), useValue: trackedDeckRepo },
        { provide: getRepositoryToken(DeckReadinessSnapshotEntity), useValue: snapshotRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: DecisionsService, useValue: decisionsService },
        { provide: SubstitutionService, useValue: substitutionService },
      ],
    }).compile();

    service = module.get<SourcesService>(SourcesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------

  describe('list', () => {
    it('returns only kind=csv sources for the user', async () => {
      // Arrange
      const csvSources = [buildCsvSource(), buildCsvSource({ id: 'csv-2', label: 'Second' })];
      csvSourceRepo.find.mockResolvedValue(csvSources);

      // Act
      const result = await service.list(USER_ID);

      // Assert
      expect(csvSourceRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID, kind: 'csv' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('returns empty array when user has no csv sources', async () => {
      // Arrange
      csvSourceRepo.find.mockResolvedValue([]);

      // Act
      const result = await service.list(USER_ID);

      // Assert
      expect(result).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // patch
  // ---------------------------------------------------------------------------

  describe('patch', () => {
    it('updates active=false and triggers readiness recompute', async () => {
      // Arrange
      const source = buildCsvSource();
      const updated = buildCsvSource({ active: false });
      csvSourceRepo.findOne
        .mockResolvedValueOnce(source)  // assertOwnsCsvSource
        .mockResolvedValueOnce(updated); // refetch after update
      csvSourceRepo.update.mockResolvedValue({ affected: 1 } as never);
      trackedDeckRepo.find.mockResolvedValue([buildDeck()]);
      decisionsService.loadExclusions.mockResolvedValue(new Set());
      substitutionService.computeAndStoreReadiness.mockResolvedValue(undefined as never);

      // Act
      const result = await service.patch(USER_ID, CSV_SOURCE_ID, { active: false });

      // Assert
      expect(csvSourceRepo.update).toHaveBeenCalledWith(
        { id: CSV_SOURCE_ID },
        expect.objectContaining({ active: false }),
      );
      expect(result.active).toBe(false);
      // Recompute was called for each deck
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(1);
    });

    it('sets active=false → triggers cross-deck recompute exactly once per affected deck', async () => {
      // Arrange
      const source = buildCsvSource();
      const updated = buildCsvSource({ active: false });
      csvSourceRepo.findOne
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(updated);
      csvSourceRepo.update.mockResolvedValue({ affected: 1 } as never);

      const decks = [buildDeck({ id: 1 }), buildDeck({ id: 2 })];
      trackedDeckRepo.find.mockResolvedValue(decks);
      decisionsService.loadExclusions.mockResolvedValue(new Set());
      substitutionService.computeAndStoreReadiness.mockResolvedValue(undefined as never);

      // Act
      await service.patch(USER_ID, CSV_SOURCE_ID, { active: false });

      // Assert: called once per deck
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(2);
    });

    it('updates label without triggering readiness recompute', async () => {
      // Arrange
      const source = buildCsvSource();
      const updated = buildCsvSource({ label: 'New Label' });
      csvSourceRepo.findOne
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(updated);
      csvSourceRepo.update.mockResolvedValue({ affected: 1 } as never);

      // Act
      const result = await service.patch(USER_ID, CSV_SOURCE_ID, { label: 'New Label' });

      // Assert
      expect(csvSourceRepo.update).toHaveBeenCalledWith(
        { id: CSV_SOURCE_ID },
        expect.objectContaining({ label: 'New Label' }),
      );
      expect(result.label).toBe('New Label');
      // No active change → no recompute
      expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
    });

    it('throws 404 when patching a manual source (non-leaky)', async () => {
      // Arrange — assertOwnsCsvSource returns a source with kind='manual' → 404
      csvSourceRepo.findOne.mockResolvedValue(buildManualSource());

      // Act & Assert
      await expect(
        service.patch(USER_ID, MANUAL_SOURCE_ID, { active: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when patching another user\'s source (non-leaky)', async () => {
      // Arrange — findOne returns a source owned by a different user
      csvSourceRepo.findOne.mockResolvedValue(
        buildCsvSource({ userId: OTHER_USER_ID }),
      );

      // Act & Assert
      await expect(
        service.patch(USER_ID, CSV_SOURCE_ID, { active: false }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 when patching a non-existent source (non-leaky)', async () => {
      // Arrange
      csvSourceRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.patch(USER_ID, 'nonexistent-id', { active: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // previewDelete
  // ---------------------------------------------------------------------------

  describe('previewDelete', () => {
    it('returns correct cardsRemoved and affected decks with pre-deletion effectivePercent', async () => {
      // Arrange
      const source = buildCsvSource();
      csvSourceRepo.findOne.mockResolvedValue(source);
      collectionCardRepo.count.mockResolvedValue(5);
      collectionCardRepo.find.mockResolvedValue([
        buildCard(1, 'WTR001'),
        buildCard(2, 'WTR002'),
      ]);
      trackedDeckRepo.find.mockResolvedValue([buildDeck()]);
      snapshotRepo.findOne.mockResolvedValue(
        buildSnapshot(DECK_ID, 80, { WTR001: {}, WTR003: {} }),
      );

      // Act
      const result = await service.previewDelete(USER_ID, CSV_SOURCE_ID);

      // Assert
      expect(result.cardsRemoved).toBe(5);
      expect(result.affectedDecks).toHaveLength(1);
      expect(result.affectedDecks[0]!.currentEffectivePercent).toBe(80);
      expect(result.affectedDecks[0]!.name).toBe('Test Deck');
    });

    it('returns empty affectedDecks when no deck references the source cards', async () => {
      // Arrange
      csvSourceRepo.findOne.mockResolvedValue(buildCsvSource());
      collectionCardRepo.count.mockResolvedValue(3);
      collectionCardRepo.find.mockResolvedValue([buildCard(1, 'XYZ999')]);
      trackedDeckRepo.find.mockResolvedValue([buildDeck()]);
      // Snapshot substitutions do NOT contain XYZ999
      snapshotRepo.findOne.mockResolvedValue(
        buildSnapshot(DECK_ID, 60, { WTR001: {}, WTR002: {} }),
      );

      // Act
      const result = await service.previewDelete(USER_ID, CSV_SOURCE_ID);

      // Assert
      expect(result.cardsRemoved).toBe(3);
      expect(result.affectedDecks).toHaveLength(0);
    });

    it('throws 404 for manual source', async () => {
      // Arrange
      csvSourceRepo.findOne.mockResolvedValue(buildManualSource());

      // Act & Assert
      await expect(
        service.previewDelete(USER_ID, MANUAL_SOURCE_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('cascades to collection_card rows and recomputes affected decks', async () => {
      // Arrange
      csvSourceRepo.findOne.mockResolvedValue(buildCsvSource());
      // Simulate transaction execution
      const mockManager = createMock<EntityManager>();
      mockManager.delete.mockResolvedValue({ affected: 1 } as never);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dataSource.transaction as jest.Mock).mockImplementation(async (cb: (manager: EntityManager) => Promise<void>) => {
        await cb(mockManager);
      });
      trackedDeckRepo.find.mockResolvedValue([buildDeck()]);
      decisionsService.loadExclusions.mockResolvedValue(new Set());
      substitutionService.computeAndStoreReadiness.mockResolvedValue(undefined as never);

      // Act
      const result = await service.delete(USER_ID, CSV_SOURCE_ID);

      // Assert
      expect(result.deleted).toBe(true);
      expect(mockManager.delete).toHaveBeenCalledWith(
        CollectionCardEntity,
        { sourceId: CSV_SOURCE_ID },
      );
      expect(mockManager.delete).toHaveBeenCalledWith(
        CsvSourceEntity,
        { id: CSV_SOURCE_ID },
      );
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(1);
    });

    it('throws 404 for manual source', async () => {
      // Arrange
      csvSourceRepo.findOne.mockResolvedValue(buildManualSource());

      // Act & Assert
      await expect(
        service.delete(USER_ID, MANUAL_SOURCE_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets recomputeWarning=true when readiness recompute fails', async () => {
      // Arrange
      csvSourceRepo.findOne.mockResolvedValue(buildCsvSource());
      const mockManager = createMock<EntityManager>();
      mockManager.delete.mockResolvedValue({ affected: 1 } as never);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dataSource.transaction as jest.Mock).mockImplementation(async (cb: (manager: EntityManager) => Promise<void>) => {
        await cb(mockManager);
      });
      trackedDeckRepo.find.mockRejectedValue(new Error('DB connection lost'));

      // Act
      const result = await service.delete(USER_ID, CSV_SOURCE_ID);

      // Assert — delete still succeeds but warns about recompute
      expect(result.deleted).toBe(true);
      expect(result.recomputeWarning).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // assertOwnsCsvSource (public, used by SourcesController tests)
  // ---------------------------------------------------------------------------

  describe('assertOwnsCsvSource', () => {
    it('resolves without error for a valid owned csv source', async () => {
      // Arrange
      csvSourceRepo.findOne.mockResolvedValue(buildCsvSource());

      // Act & Assert
      await expect(
        service.assertOwnsCsvSource(USER_ID, CSV_SOURCE_ID),
      ).resolves.toBeUndefined();
    });

    it('throws 404 for kind=manual (non-leaky)', async () => {
      // Arrange
      csvSourceRepo.findOne.mockResolvedValue(buildManualSource());

      // Act & Assert
      await expect(
        service.assertOwnsCsvSource(USER_ID, MANUAL_SOURCE_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 for another user\'s source (non-leaky)', async () => {
      // Arrange
      csvSourceRepo.findOne.mockResolvedValue(buildCsvSource({ userId: OTHER_USER_ID }));

      // Act & Assert
      await expect(
        service.assertOwnsCsvSource(USER_ID, CSV_SOURCE_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws 404 for non-existent source (non-leaky)', async () => {
      // Arrange
      csvSourceRepo.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assertOwnsCsvSource(USER_ID, 'ghost-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
