import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { CsvParserService } from '../csv/csv-parser.service';
import { DuplicateDetectionService } from '../csv/duplicate-detection.service';
import { CsvUploadService } from '../csv/csv-upload.service';
import { DecisionsService } from '../../decks/decisions/decisions.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import {
  ICsvParseResult,
  IResolvedCsvRow,
  ISkippedCsvRow,
  TDuplicateDetectionResult,
} from '../csv/csv.types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-uuid-upload-001';
const SOURCE_ID_A = 'source-uuid-a';
const HASH_A = 'aaaa1234567890abcdefabcdef1234567890abcdefabcdef1234567890abcdef';

function buildSource(overrides: Partial<CsvSourceEntity> = {}): CsvSourceEntity {
  return {
    id: SOURCE_ID_A,
    userId: USER_ID,
    kind: 'csv',
    label: 'My CSV',
    originalFilename: 'collection.csv',
    sourceUrl: null,
    contentHash: HASH_A,
    cardCount: 2,
    active: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    user: {} as CsvSourceEntity['user'],
    ...overrides,
  };
}

function buildCard(
  id: number,
  cardIdentifier: string,
  quantity = 1,
  sourceId = SOURCE_ID_A,
): CollectionCardEntity {
  return {
    id,
    userId: USER_ID,
    sourceId,
    cardIdentifier,
    quantity,
    lastUpdated: new Date(),
    user: {} as CollectionCardEntity['user'],
    source: {} as CollectionCardEntity['source'],
  };
}

function buildParseResult(
  resolved: IResolvedCsvRow[] = [],
  skipped: ISkippedCsvRow[] = [],
): ICsvParseResult {
  return { resolved, skipped };
}

function buildBuffer(content = 'Name,Quantity\nCommand and Conquer,3'): Buffer {
  return Buffer.from(content, 'utf-8');
}

// ---------------------------------------------------------------------------
// Module setup
// ---------------------------------------------------------------------------

describe('CsvUploadService', () => {
  let service: CsvUploadService;
  let csvSourceRepo: DeepMocked<Repository<CsvSourceEntity>>;
  let collectionCardRepo: DeepMocked<Repository<CollectionCardEntity>>;
  let trackedDeckRepo: DeepMocked<Repository<TrackedDeckEntity>>;
  let deckCardRepo: DeepMocked<Repository<DeckCardEntity>>;
  let dataSource: DeepMocked<DataSource>;
  let csvParserService: DeepMocked<CsvParserService>;
  let duplicateDetectionService: DeepMocked<DuplicateDetectionService>;
  let decisionsService: DeepMocked<DecisionsService>;
  let substitutionService: DeepMocked<SubstitutionService>;

  beforeEach(async () => {
    csvSourceRepo = createMock<Repository<CsvSourceEntity>>();
    collectionCardRepo = createMock<Repository<CollectionCardEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    dataSource = createMock<DataSource>();
    csvParserService = createMock<CsvParserService>();
    duplicateDetectionService = createMock<DuplicateDetectionService>();
    decisionsService = createMock<DecisionsService>();
    substitutionService = createMock<SubstitutionService>();

    // Default: no tracked decks (skip recompute loop)
    trackedDeckRepo.find.mockResolvedValue([]);
    decisionsService.loadExclusions.mockResolvedValue(new Set<string>());
    substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvUploadService,
        { provide: getRepositoryToken(CsvSourceEntity), useValue: csvSourceRepo },
        { provide: getRepositoryToken(CollectionCardEntity), useValue: collectionCardRepo },
        { provide: getRepositoryToken(TrackedDeckEntity), useValue: trackedDeckRepo },
        { provide: getRepositoryToken(DeckCardEntity), useValue: deckCardRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: CsvParserService, useValue: csvParserService },
        { provide: DuplicateDetectionService, useValue: duplicateDetectionService },
        { provide: DecisionsService, useValue: decisionsService },
        { provide: SubstitutionService, useValue: substitutionService },
      ],
    }).compile();

    service = module.get<CsvUploadService>(CsvUploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // action='cancel'
  // ---------------------------------------------------------------------------

  describe("action='cancel'", () => {
    it('returns { kind: cancelled } without calling any other service', async () => {
      // Act
      const result = await service.handle(USER_ID, buildBuffer(), 'cancel');

      // Assert
      expect(result.kind).toBe('cancelled');
      expect(csvParserService.parse).not.toHaveBeenCalled();
      expect(duplicateDetectionService.detect).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // action='auto' — new source
  // ---------------------------------------------------------------------------

  describe("action='auto' — detection returns 'new'", () => {
    it('creates a new source and returns { kind: created }', async () => {
      // Arrange
      const resolved: IResolvedCsvRow[] = [
        { rowNumber: 2, cardIdentifier: 'command-and-conquer', quantity: 3 },
      ];
      csvParserService.parse.mockReturnValue(buildParseResult(resolved));

      const detection: TDuplicateDetectionResult = { kind: 'new' };
      duplicateDetectionService.detect.mockResolvedValue(detection);

      const savedSource = buildSource({ id: 'new-source-id' });

      // Mock transaction to call the callback with a fake manager
      const manager = createMock<EntityManager>();
      (manager.create as jest.Mock).mockImplementation((_entity: unknown, data: unknown) =>
        data,
      );
      manager.save.mockResolvedValueOnce(savedSource); // source save
      manager.save.mockResolvedValueOnce([]); // cards save

      // DataSource.transaction has overloads; cast to the simplest form.
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (fn: (em: EntityManager) => Promise<unknown>) => fn(manager),
      );

      // Act
      const result = await service.handle(USER_ID, buildBuffer(), 'auto', undefined, 'col.csv');

      // Assert
      expect(result.kind).toBe('created');
      if (result.kind === 'created') {
        expect(result.sourceId).toBe('new-source-id');
        expect(result.cardCount).toBe(1);
        expect(result.skippedRows).toEqual([]);
      }
      expect(duplicateDetectionService.detect).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // action='auto' — exact-match
  // ---------------------------------------------------------------------------

  describe("action='auto' — detection returns 'exact-match'", () => {
    it('returns { kind: exact-match } without writing to DB', async () => {
      // Arrange
      const resolved: IResolvedCsvRow[] = [
        { rowNumber: 2, cardIdentifier: 'command-and-conquer', quantity: 3 },
      ];
      csvParserService.parse.mockReturnValue(buildParseResult(resolved));

      const detection: TDuplicateDetectionResult = {
        kind: 'exact-match',
        existingSourceId: SOURCE_ID_A,
        existingLabel: 'My CSV',
        cardCount: 1,
      };
      duplicateDetectionService.detect.mockResolvedValue(detection);

      // Act
      const result = await service.handle(USER_ID, buildBuffer(), 'auto');

      // Assert
      expect(result.kind).toBe('exact-match');
      if (result.kind === 'exact-match') {
        expect(result.existingSourceId).toBe(SOURCE_ID_A);
        expect(result.existingLabel).toBe('My CSV');
      }
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // action='auto' — partial-overlap
  // ---------------------------------------------------------------------------

  describe("action='auto' — detection returns 'partial-overlap'", () => {
    it('returns { kind: partial-overlap } without writing to DB', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([
        { rowNumber: 2, cardIdentifier: 'command-and-conquer', quantity: 3 },
      ]));

      const detection: TDuplicateDetectionResult = {
        kind: 'partial-overlap',
        existingSourceId: SOURCE_ID_A,
        existingLabel: 'My CSV',
        similarityScore: 0.75,
        cardCount: 1,
        delta: { added: [], removed: [], increased: [], decreased: [] },
      };
      duplicateDetectionService.detect.mockResolvedValue(detection);

      // Act
      const result = await service.handle(USER_ID, buildBuffer(), 'auto');

      // Assert
      expect(result.kind).toBe('partial-overlap');
      if (result.kind === 'partial-overlap') {
        expect(result.similarityScore).toBe(0.75);
        expect(result.existingSourceId).toBe(SOURCE_ID_A);
      }
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // action='separate'
  // ---------------------------------------------------------------------------

  describe("action='separate'", () => {
    it('always creates a new source without calling detect', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([
        { rowNumber: 2, cardIdentifier: 'command-and-conquer', quantity: 3 },
      ]));

      const savedSource = buildSource({ id: 'separate-source-id' });
      const manager = createMock<EntityManager>();
      (manager.create as jest.Mock).mockImplementation((_entity: unknown, data: unknown) => data);
      manager.save.mockResolvedValueOnce(savedSource);
      manager.save.mockResolvedValueOnce([]);

      // DataSource.transaction has overloads; cast to jest.Mock to avoid TS overload noise.
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (fn: (em: EntityManager) => Promise<unknown>) => fn(manager),
      );

      // Act
      const result = await service.handle(USER_ID, buildBuffer(), 'separate');

      // Assert
      expect(result.kind).toBe('created');
      expect(duplicateDetectionService.detect).not.toHaveBeenCalled();
    });

    it('disambiguates the label with a "#N" counter when the name already exists', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([
        { rowNumber: 2, cardIdentifier: 'command-and-conquer', quantity: 3 },
      ]));

      const manager = createMock<EntityManager>();
      // The user already has a source named after this file.
      manager.find.mockResolvedValue([
        { label: 'collection.csv' },
      ] as never);
      (manager.create as jest.Mock).mockImplementation(
        (_entity: unknown, data: unknown) => data,
      );
      manager.save.mockResolvedValueOnce(buildSource());
      manager.save.mockResolvedValueOnce([]);

      (dataSource.transaction as jest.Mock).mockImplementation(
        async (fn: (em: EntityManager) => Promise<unknown>) => fn(manager),
      );

      // Act
      await service.handle(
        USER_ID,
        buildBuffer(),
        'separate',
        undefined,
        'collection.csv',
      );

      // Assert: the created csv source carries the de-duplicated label.
      const sourceCreate = (manager.create as jest.Mock).mock.calls.find(
        (call) =>
          typeof call[1] === 'object' &&
          (call[1] as { kind?: string }).kind === 'csv',
      );
      const payload = sourceCreate?.[1] as { label?: string };
      expect(payload.label).toBe('#2 collection.csv');
    });
  });

  // ---------------------------------------------------------------------------
  // action='replace'
  // ---------------------------------------------------------------------------

  describe("action='replace'", () => {
    it('throws MISSING_TARGET_SOURCE when targetSourceId is absent', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([]));

      // Act + Assert
      await expect(
        service.handle(USER_ID, buildBuffer(), 'replace', undefined),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.handle(USER_ID, buildBuffer(), 'replace', undefined),
      ).rejects.toThrow('MISSING_TARGET_SOURCE');
    });

    it('throws NotFoundException when target source belongs to another user', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([]));
      // findOne returns a source owned by another user
      csvSourceRepo.findOne.mockResolvedValue(buildSource({ userId: 'other-user' }));

      // Act + Assert
      await expect(
        service.handle(USER_ID, buildBuffer(), 'replace', SOURCE_ID_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when target source kind is manual', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([]));
      csvSourceRepo.findOne.mockResolvedValue(buildSource({ kind: 'manual', userId: USER_ID }));

      // Act + Assert
      await expect(
        service.handle(USER_ID, buildBuffer(), 'replace', SOURCE_ID_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when target source does not exist', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([]));
      csvSourceRepo.findOne.mockResolvedValue(null);

      // Act + Assert
      await expect(
        service.handle(USER_ID, buildBuffer(), 'replace', SOURCE_ID_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('cascade-deletes old rows and creates new source', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([
        { rowNumber: 2, cardIdentifier: 'command-and-conquer', quantity: 3 },
      ]));
      csvSourceRepo.findOne.mockResolvedValue(buildSource({ userId: USER_ID, kind: 'csv' }));

      const newSource = buildSource({ id: 'replaced-source-id' });
      const manager = createMock<EntityManager>();
      manager.delete.mockResolvedValue({ affected: 2 } as never);
      (manager.create as jest.Mock).mockImplementation((_entity: unknown, data: unknown) => data);
      manager.save.mockResolvedValueOnce(newSource);
      manager.save.mockResolvedValueOnce([]);

      // DataSource.transaction has overloads; cast to jest.Mock to avoid TS overload noise.
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (fn: (em: EntityManager) => Promise<unknown>) => fn(manager),
      );

      // Act
      const result = await service.handle(USER_ID, buildBuffer(), 'replace', SOURCE_ID_A);

      // Assert
      expect(result.kind).toBe('replaced');
      if (result.kind === 'replaced') {
        expect(result.sourceId).toBe('replaced-source-id');
      }
      // Verify cascade-delete of old cards and source
      expect(manager.delete).toHaveBeenCalledWith(CollectionCardEntity, { sourceId: SOURCE_ID_A });
      expect(manager.delete).toHaveBeenCalledWith(CsvSourceEntity, { id: SOURCE_ID_A });
    });
  });

  // ---------------------------------------------------------------------------
  // action='update'
  // ---------------------------------------------------------------------------

  describe("action='update'", () => {
    it('throws MISSING_TARGET_SOURCE when targetSourceId is absent', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([]));

      // Act + Assert
      await expect(
        service.handle(USER_ID, buildBuffer(), 'update', undefined),
      ).rejects.toThrow('MISSING_TARGET_SOURCE');
    });

    it('throws NotFoundException when target source belongs to another user', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([]));
      csvSourceRepo.findOne.mockResolvedValue(buildSource({ userId: 'other-user' }));

      // Act + Assert
      await expect(
        service.handle(USER_ID, buildBuffer(), 'update', SOURCE_ID_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when target source kind is manual', async () => {
      // Arrange
      csvParserService.parse.mockReturnValue(buildParseResult([]));
      csvSourceRepo.findOne.mockResolvedValue(buildSource({ kind: 'manual', userId: USER_ID }));

      // Act + Assert
      await expect(
        service.handle(USER_ID, buildBuffer(), 'update', SOURCE_ID_A),
      ).rejects.toThrow(NotFoundException);
    });

    it('preserves the sourceId and returns { kind: updated }', async () => {
      // Arrange
      const resolved: IResolvedCsvRow[] = [
        { rowNumber: 2, cardIdentifier: 'command-and-conquer', quantity: 1 },
        { rowNumber: 3, cardIdentifier: 'enlightened-strike', quantity: 2 },
      ];
      csvParserService.parse.mockReturnValue(buildParseResult(resolved));
      csvSourceRepo.findOne.mockResolvedValue(buildSource({ userId: USER_ID, kind: 'csv' }));

      const existingCards = [
        buildCard(1, 'command-and-conquer', 4), // was qty=4, incoming=1 → decreased
        buildCard(2, 'old-card', 2),             // removed
      ];

      const manager = createMock<EntityManager>();
      manager.find.mockResolvedValue(existingCards);
      manager.update.mockResolvedValue({ affected: 1 } as never);
      manager.save.mockResolvedValue({} as never);
      manager.delete.mockResolvedValue({ affected: 1 } as never);
      (manager.create as jest.Mock).mockImplementation((_entity: unknown, data: unknown) => data);

      // DataSource.transaction has overloads; cast to jest.Mock to avoid TS overload noise.
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (fn: (em: EntityManager) => Promise<unknown>) => fn(manager),
      );

      // Act
      const result = await service.handle(USER_ID, buildBuffer(), 'update', SOURCE_ID_A);

      // Assert
      expect(result.kind).toBe('updated');
      if (result.kind === 'updated') {
        expect(result.sourceId).toBe(SOURCE_ID_A); // same id preserved
        expect(result.cardCount).toBe(2);
        // Delta: command-and-conquer decreased (4→1), enlightened-strike added, old-card removed
        expect(result.delta.decreased.map((d) => d.cardIdentifier)).toContain('command-and-conquer');
        expect(result.delta.added.map((a) => a.cardIdentifier)).toContain('enlightened-strike');
        expect(result.delta.removed.map((r) => r.cardIdentifier)).toContain('old-card');
      }
    });

    it('sets quantity to new value (not sum) when card qty=4 old → qty=1 new ends at 1', async () => {
      // Arrange: a card that is qty=4 in existing and qty=1 in incoming should end at qty=1.
      const resolved: IResolvedCsvRow[] = [
        { rowNumber: 2, cardIdentifier: 'command-and-conquer', quantity: 1 },
      ];
      csvParserService.parse.mockReturnValue(buildParseResult(resolved));
      csvSourceRepo.findOne.mockResolvedValue(buildSource({ userId: USER_ID, kind: 'csv' }));

      const existingCards = [buildCard(1, 'command-and-conquer', 4)];
      const manager = createMock<EntityManager>();
      manager.find.mockResolvedValue(existingCards);
      manager.update.mockResolvedValue({ affected: 1 } as never);
      manager.save.mockResolvedValue({} as never);
      manager.delete.mockResolvedValue({ affected: 0 } as never);
      (manager.create as jest.Mock).mockImplementation((_entity: unknown, data: unknown) => data);

      // DataSource.transaction has overloads; cast to jest.Mock to avoid TS overload noise.
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (fn: (em: EntityManager) => Promise<unknown>) => fn(manager),
      );

      // Act
      await service.handle(USER_ID, buildBuffer(), 'update', SOURCE_ID_A);

      // Assert: manager.update called with { quantity: 1 } (not 4+1=5 or similar)
      expect(manager.update).toHaveBeenCalledWith(
        CollectionCardEntity,
        { id: 1 },
        { quantity: 1 },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Readiness recompute is non-fatal
  // ---------------------------------------------------------------------------

  describe('readiness recompute', () => {
    it('does not throw when recompute fails for a deck', async () => {
      // Arrange: one tracked deck, recompute throws
      csvParserService.parse.mockReturnValue(buildParseResult([]));
      duplicateDetectionService.detect.mockResolvedValue({ kind: 'new' });

      const savedSource = buildSource({ id: 'new-source-id' });
      const manager = createMock<EntityManager>();
      (manager.create as jest.Mock).mockImplementation((_entity: unknown, data: unknown) => data);
      manager.save.mockResolvedValue(savedSource);

      // DataSource.transaction has overloads; cast to jest.Mock to avoid TS overload noise.
      (dataSource.transaction as jest.Mock).mockImplementation(
        async (fn: (em: EntityManager) => Promise<unknown>) => fn(manager),
      );

      trackedDeckRepo.find.mockResolvedValue([
        { id: 1, userId: USER_ID } as TrackedDeckEntity,
      ]);
      decisionsService.loadExclusions.mockResolvedValue(new Set<string>());
      substitutionService.computeAndStoreReadiness.mockRejectedValue(
        new Error('Readiness engine failure'),
      );

      // Act + Assert: does NOT throw despite recompute failing
      await expect(
        service.handle(USER_ID, buildBuffer(), 'auto'),
      ).resolves.toBeDefined();
    });
  });
});
