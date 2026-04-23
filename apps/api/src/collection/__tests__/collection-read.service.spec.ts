import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionReadService } from '../collection-read.service';

const USER_ID = 'user-uuid-read-001';
const MANUAL_SOURCE_ID = 'manual-source-uuid-001';
const CSV_SOURCE_ID_1 = 'csv-source-uuid-001';
const CSV_SOURCE_ID_2 = 'csv-source-uuid-002';

function buildSource(overrides: Partial<CsvSourceEntity> = {}): CsvSourceEntity {
  return {
    id: MANUAL_SOURCE_ID,
    userId: USER_ID,
    kind: 'manual',
    label: 'Manual entries',
    originalFilename: null,
    sourceUrl: null,
    contentHash: null,
    cardCount: null,
    active: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    user: {} as CsvSourceEntity['user'],
    ...overrides,
  };
}

function buildCard(overrides: Partial<CollectionCardEntity> = {}): CollectionCardEntity {
  return {
    id: 1,
    userId: USER_ID,
    cardIdentifier: 'WTR001',
    sourceId: MANUAL_SOURCE_ID,
    quantity: 1,
    lastUpdated: new Date('2025-01-15T10:00:00Z'),
    user: {} as CollectionCardEntity['user'],
    source: {} as CollectionCardEntity['source'],
    ...overrides,
  };
}

describe('CollectionReadService', () => {
  let service: CollectionReadService;
  let collectionCardRepo: jest.Mocked<Repository<CollectionCardEntity>>;
  let csvSourceRepo: jest.Mocked<Repository<CsvSourceEntity>>;

  beforeEach(async () => {
    collectionCardRepo = createMock<Repository<CollectionCardEntity>>();
    csvSourceRepo = createMock<Repository<CsvSourceEntity>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionReadService,
        {
          provide: getRepositoryToken(CollectionCardEntity),
          useValue: collectionCardRepo,
        },
        {
          provide: getRepositoryToken(CsvSourceEntity),
          useValue: csvSourceRepo,
        },
      ],
    }).compile();

    service = module.get<CollectionReadService>(CollectionReadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadOwned', () => {
    it('returns empty map when user has no active sources', async () => {
      // Arrange
      csvSourceRepo.find.mockResolvedValue([]);

      // Act
      const result = await service.loadOwned(USER_ID);

      // Assert
      expect(result.size).toBe(0);
      expect(collectionCardRepo.find).not.toHaveBeenCalled();
    });

    it('returns empty map when cardIdentifiers filter is empty array', async () => {
      // Arrange — sources exist but empty filter array short-circuits.
      csvSourceRepo.find.mockResolvedValue([buildSource()]);

      // Act
      const result = await service.loadOwned(USER_ID, []);

      // Assert
      expect(result.size).toBe(0);
      expect(collectionCardRepo.find).not.toHaveBeenCalled();
    });

    it('sums quantities across multiple active sources for the same card', async () => {
      // Arrange: manual source (3 copies) + one CSV source (2 copies).
      csvSourceRepo.find.mockResolvedValue([
        buildSource({ id: MANUAL_SOURCE_ID }),
        buildSource({ id: CSV_SOURCE_ID_1, kind: 'csv', label: 'My CSV' }),
      ]);

      collectionCardRepo.find.mockResolvedValue([
        buildCard({ id: 1, sourceId: MANUAL_SOURCE_ID, cardIdentifier: 'WTR001', quantity: 3 }),
        buildCard({ id: 2, sourceId: CSV_SOURCE_ID_1, cardIdentifier: 'WTR001', quantity: 2 }),
      ]);

      // Act
      const result = await service.loadOwned(USER_ID);

      // Assert: sum is 3 + 2 = 5.
      expect(result.get('WTR001')).toBe(5);
      expect(result.size).toBe(1);
    });

    it('excludes cards from inactive sources', async () => {
      // Arrange: manual source (active) + inactive CSV source.
      // csvSourceRepo.find is called with { userId, active: true } so the
      // inactive source never appears in activeSources.
      csvSourceRepo.find.mockResolvedValue([
        buildSource({ id: MANUAL_SOURCE_ID, active: true }),
        // The inactive source is filtered by the DB query — not returned.
      ]);

      // Cards: only manual source cards returned since inactive source
      // is excluded by the active=true filter.
      collectionCardRepo.find.mockResolvedValue([
        buildCard({ id: 1, sourceId: MANUAL_SOURCE_ID, cardIdentifier: 'WTR001', quantity: 2 }),
      ]);

      // Act
      const result = await service.loadOwned(USER_ID);

      // Assert: only manual source contributes.
      expect(result.get('WTR001')).toBe(2);
    });

    it('filters by cardIdentifiers when provided', async () => {
      // Arrange
      csvSourceRepo.find.mockResolvedValue([buildSource()]);
      collectionCardRepo.find.mockResolvedValue([
        buildCard({ id: 1, cardIdentifier: 'WTR001', quantity: 3 }),
      ]);

      // Act — only ask for WTR001.
      const result = await service.loadOwned(USER_ID, ['WTR001']);

      // Assert
      expect(result.get('WTR001')).toBe(3);
    });

    it('returns a map with quantities from manual + CSV sources', async () => {
      // Arrange: user has 2 active sources with non-overlapping cards.
      csvSourceRepo.find.mockResolvedValue([
        buildSource({ id: MANUAL_SOURCE_ID }),
        buildSource({ id: CSV_SOURCE_ID_1, kind: 'csv', label: 'CSV 1' }),
      ]);

      collectionCardRepo.find.mockResolvedValue([
        buildCard({ id: 1, sourceId: MANUAL_SOURCE_ID, cardIdentifier: 'WTR001', quantity: 1 }),
        buildCard({ id: 2, sourceId: CSV_SOURCE_ID_1, cardIdentifier: 'WTR002', quantity: 4 }),
      ]);

      // Act
      const result = await service.loadOwned(USER_ID);

      // Assert
      expect(result.get('WTR001')).toBe(1);
      expect(result.get('WTR002')).toBe(4);
      expect(result.size).toBe(2);
    });

    it('excludes entries where summed quantity is 0 or negative', async () => {
      // Arrange: unusual edge — quantity 0 row somehow present.
      csvSourceRepo.find.mockResolvedValue([buildSource()]);
      collectionCardRepo.find.mockResolvedValue([
        buildCard({ id: 1, cardIdentifier: 'WTR001', quantity: 0 }),
      ]);

      // Act
      const result = await service.loadOwned(USER_ID);

      // Assert: zero-quantity entries are excluded.
      expect(result.has('WTR001')).toBe(false);
    });
  });

  describe('countUniqueOwned', () => {
    it('returns 0 when user has no active sources', async () => {
      // Arrange
      csvSourceRepo.find.mockResolvedValue([]);

      // Act
      const count = await service.countUniqueOwned(USER_ID);

      // Assert
      expect(count).toBe(0);
    });

    it('returns the number of distinct card identifiers with qty > 0', async () => {
      // Arrange: 2 unique cards across 2 active sources.
      csvSourceRepo.find.mockResolvedValue([
        buildSource({ id: MANUAL_SOURCE_ID }),
        buildSource({ id: CSV_SOURCE_ID_1, kind: 'csv', label: 'CSV 1' }),
      ]);

      collectionCardRepo.find.mockResolvedValue([
        buildCard({ id: 1, sourceId: MANUAL_SOURCE_ID, cardIdentifier: 'WTR001', quantity: 2 }),
        buildCard({ id: 2, sourceId: CSV_SOURCE_ID_1, cardIdentifier: 'WTR001', quantity: 1 }),
        buildCard({ id: 3, sourceId: MANUAL_SOURCE_ID, cardIdentifier: 'WTR002', quantity: 3 }),
      ]);

      // Act
      const count = await service.countUniqueOwned(USER_ID);

      // Assert: WTR001 + WTR002 = 2 unique cards.
      expect(count).toBe(2);
    });

    it('counts cards summed across manual + CSV sources', async () => {
      // Arrange: manual source has card-a; CSV source has card-b; both active.
      csvSourceRepo.find.mockResolvedValue([
        buildSource({ id: MANUAL_SOURCE_ID }),
        buildSource({ id: CSV_SOURCE_ID_2, kind: 'csv', label: 'CSV 2' }),
      ]);

      collectionCardRepo.find.mockResolvedValue([
        buildCard({ id: 1, sourceId: MANUAL_SOURCE_ID, cardIdentifier: 'card-a', quantity: 1 }),
        buildCard({ id: 2, sourceId: CSV_SOURCE_ID_2, cardIdentifier: 'card-b', quantity: 1 }),
      ]);

      // Act
      const count = await service.countUniqueOwned(USER_ID);

      // Assert: 2 unique cards.
      expect(count).toBe(2);
    });
  });
});
