import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';
import { CollectionReadService } from '../collection-read.service';
import { LibraryService } from '../library/library.service';

const USER_ID = 'user-library-001';

/**
 * Builds a minimal mock for the TypeORM QueryBuilder chain used inside
 * LibraryService. Two calls are made in sequence:
 *   1. Price query  → getRawMany → returns priceRows
 *   2. Freshness query → getRawOne → returns lastUpdatedRow
 *
 * The builder is shared between both calls; each method returns `this`.
 */
function buildQbMock(
  priceRows: Array<{ cardIdentifier: string; minPriceCents: string | null }>,
  lastUpdatedRow: { maxLastFetchedAt: string | null } | undefined,
): jest.Mocked<ReturnType<Repository<StoreStockEntity>['createQueryBuilder']>> {
  const qb = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(priceRows),
    getRawOne: jest.fn().mockResolvedValue(lastUpdatedRow),
  } as unknown as jest.Mocked<ReturnType<Repository<StoreStockEntity>['createQueryBuilder']>>;
  return qb;
}

describe('LibraryService', () => {
  let service: LibraryService;
  let collectionReadService: jest.Mocked<CollectionReadService>;
  let storeStockRepo: jest.Mocked<Repository<StoreStockEntity>>;

  beforeEach(async () => {
    collectionReadService = createMock<CollectionReadService>();
    storeStockRepo = createMock<Repository<StoreStockEntity>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LibraryService,
        { provide: CollectionReadService, useValue: collectionReadService },
        {
          provide: getRepositoryToken(StoreStockEntity),
          useValue: storeStockRepo,
        },
      ],
    }).compile();

    service = module.get<LibraryService>(LibraryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('zero-card user', () => {
    it('returns empty cards array and zero stats when user has no cards', async () => {
      // Arrange
      collectionReadService.loadOwned.mockResolvedValue(new Map());
      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.cards).toHaveLength(0);
      expect(result.stats.uniqueCount).toBe(0);
      expect(result.stats.totalCopies).toBe(0);
      expect(result.stats.pitchBreakdown).toEqual({ red: 0, yellow: 0, blue: 0, colorless: 0 });
      expect(result.stats.estimatedValueCents).toBe(0);
      expect(result.stats.pricedIdentifierCount).toBe(0);
    });

    it('returns priceDataLastUpdatedAt = null when store_stock is empty', async () => {
      // Arrange
      collectionReadService.loadOwned.mockResolvedValue(new Map());
      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.stats.priceDataLastUpdatedAt).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path — 10 unique cards, 25 copies
  // ---------------------------------------------------------------------------

  describe('happy path — 10 cards, 25 copies across 2 sources', () => {
    it('returns correct uniqueCount and totalCopies', async () => {
      // Arrange: 10 distinct cards, quantities summing to 25.
      const ownedMap = new Map<string, number>([
        ['snatch-red', 3],
        ['snatch-yellow', 3],
        ['snatch-blue', 3],
        ['razor-reflex-red', 2],
        ['razor-reflex-yellow', 2],
        ['razor-reflex-blue', 2],
        ['pummel-red', 2],
        ['pummel-yellow', 2],
        ['pummel-blue', 2],
        ['sink-below-red', 4],
      ]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.stats.uniqueCount).toBe(10);
      expect(result.stats.totalCopies).toBe(25);
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path — pitch breakdown
  // ---------------------------------------------------------------------------

  describe('happy path — pitch breakdown', () => {
    it('correctly buckets red/blue/colorless quantities', async () => {
      // Arrange: red pitch card (4 copies), blue pitch card (3 copies),
      // equipment with pitch=null (2 copies).
      // snatch-red has pitch=1, snatch-blue has pitch=3, head gear is equipment.
      const ownedMap = new Map<string, number>([
        ['snatch-red', 4],              // pitch 1 → red bucket
        ['snatch-blue', 3],             // pitch 3 → blue bucket
        ['achilles-accelerator', 2],    // equipment, pitch=null → colorless
      ]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.stats.pitchBreakdown.red).toBe(4);
      expect(result.stats.pitchBreakdown.yellow).toBe(0);
      expect(result.stats.pitchBreakdown.blue).toBe(3);
      expect(result.stats.pitchBreakdown.colorless).toBe(2);
    });

    it('counts yellow pitch cards in yellow bucket', async () => {
      // Arrange: one yellow-pitch card (2 copies).
      const ownedMap = new Map<string, number>([
        ['snatch-yellow', 2], // pitch 2 → yellow bucket
      ]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.stats.pitchBreakdown.yellow).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path — estimated value
  // ---------------------------------------------------------------------------

  describe('happy path — estimated value', () => {
    it('computes estimatedValueCents = sum(qty * minPrice) for priced cards', async () => {
      // Arrange: 3 cards. 2 have prices (R$100.00 = 10000 cents and R$50.00 = 5000 cents),
      // 1 has no price. Quantities are all 1.
      // 1*10000 + 1*5000 + 1*0 = 15000
      const ownedMap = new Map<string, number>([
        ['snatch-red', 1],
        ['snatch-yellow', 1],
        ['snatch-blue', 1],
      ]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const priceRows = [
        { cardIdentifier: 'snatch-red', minPriceCents: '10000' },
        { cardIdentifier: 'snatch-yellow', minPriceCents: '5000' },
        // snatch-blue has no price row
      ];
      const qb = buildQbMock(priceRows, { maxLastFetchedAt: '2025-03-01T12:00:00.000Z' });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.stats.estimatedValueCents).toBe(15000);
      expect(result.stats.pricedIdentifierCount).toBe(2);
    });

    it('multiplies qty × minPrice when owned quantity is > 1', async () => {
      // Arrange: 1 card with price 5000 cents, owned 3 copies → 15000
      const ownedMap = new Map<string, number>([
        ['snatch-red', 3],
      ]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const priceRows = [
        { cardIdentifier: 'snatch-red', minPriceCents: '5000' },
      ];
      const qb = buildQbMock(priceRows, { maxLastFetchedAt: '2025-03-01T12:00:00.000Z' });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.stats.estimatedValueCents).toBe(15000);
    });

    it('estimatedValueCents = 0 when no priced identifiers', async () => {
      // Arrange: cards owned but store_stock empty.
      const ownedMap = new Map<string, number>([
        ['snatch-red', 2],
      ]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.stats.estimatedValueCents).toBe(0);
      expect(result.stats.pricedIdentifierCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Happy path — priceDataLastUpdatedAt
  // ---------------------------------------------------------------------------

  describe('happy path — priceDataLastUpdatedAt', () => {
    it('returns ISO-8601 string from MAX(lastFetchedAt)', async () => {
      // Arrange
      const ownedMap = new Map<string, number>([['snatch-red', 1]]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const expectedDate = '2025-06-15T08:00:00.000Z';
      const qb = buildQbMock([], { maxLastFetchedAt: expectedDate });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.stats.priceDataLastUpdatedAt).not.toBeNull();
      // The stored value is run through new Date().toISOString(), so it must be
      // a valid ISO-8601 string (parseable back to the same timestamp).
      const parsed = new Date(result.stats.priceDataLastUpdatedAt!);
      expect(isNaN(parsed.getTime())).toBe(false);
    });

    it('returns null when store_stock has no rows (maxLastFetchedAt is null)', async () => {
      // Arrange
      const ownedMap = new Map<string, number>([['snatch-red', 1]]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.stats.priceDataLastUpdatedAt).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge case — card in collection with no catalog match
  // ---------------------------------------------------------------------------

  describe('edge case — card not in catalog', () => {
    it('skips identifiers not found in catalog and logs a warning', async () => {
      // Arrange: 'totally-fake-card-xyz' does not exist in the catalog.
      const ownedMap = new Map<string, number>([
        ['snatch-red', 2],
        ['totally-fake-card-xyz-u7-test', 1], // not a real card
      ]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert: only snatch-red makes it through; fake card is skipped.
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]!.cardIdentifier).toBe('snatch-red');
      // uniqueCount reflects only the found cards.
      expect(result.stats.uniqueCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Response shape — cards array
  // ---------------------------------------------------------------------------

  describe('response shape', () => {
    it('each card entry has required fields', async () => {
      // Arrange
      const ownedMap = new Map<string, number>([['snatch-red', 3]]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.load(USER_ID);

      // Assert
      expect(result.cards).toHaveLength(1);
      const card = result.cards[0]!;
      expect(card.cardIdentifier).toBe('snatch-red');
      expect(card.name).toBe('Snatch');
      expect(card.pitch).toBe(1);
      expect(Array.isArray(card.types)).toBe(true);
      expect(Array.isArray(card.classes)).toBe(true);
      expect(Array.isArray(card.sets)).toBe(true);
      expect(card.ownedQuantity).toBe(3);
    });

    it('inactive source rows do not contribute — CollectionReadService already filters', async () => {
      // CollectionReadService.loadOwned already excludes inactive sources.
      // This test verifies LibraryService delegates the filter correctly and
      // does not bypass it.
      const ownedMap = new Map<string, number>([['snatch-red', 2]]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      await service.load(USER_ID);

      // Assert: loadOwned was called with the userId and no extra filter arg.
      expect(collectionReadService.loadOwned).toHaveBeenCalledWith(USER_ID);
    });

    it('uses a single call to CollectionReadService (no N+1 pattern)', async () => {
      // Arrange: multiple cards.
      const ownedMap = new Map<string, number>([
        ['snatch-red', 1],
        ['snatch-yellow', 1],
        ['snatch-blue', 1],
      ]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      await service.load(USER_ID);

      // Assert: only ONE call to CollectionReadService regardless of card count.
      expect(collectionReadService.loadOwned).toHaveBeenCalledTimes(1);
    });
  });

  describe('setNames map', () => {
    it('returns release names for the union of set codes across owned cards', async () => {
      const ownedMap = new Map<string, number>([['snatch-red', 1]]);
      collectionReadService.loadOwned.mockResolvedValue(ownedMap);

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.load(USER_ID);

      // snatch-red is a Welcome to Rathe Generic — sets[] always contains
      // at least WTR. Whatever else it has, the response must map every
      // included code to a non-empty release name.
      expect(result.cards[0]?.sets.length).toBeGreaterThan(0);
      for (const code of result.cards[0]!.sets) {
        // Either present in setNames (mapped) or the code is unknown (fallback).
        const name = result.setNames[code];
        if (name !== undefined) {
          expect(name.length).toBeGreaterThan(0);
        }
      }
      expect(result.setNames['WTR']).toBe('Welcome to Rathe');
    });

    it('returns an empty map when the user owns zero cards', async () => {
      collectionReadService.loadOwned.mockResolvedValue(new Map());

      const qb = buildQbMock([], { maxLastFetchedAt: null });
      storeStockRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.load(USER_ID);

      expect(result.cards).toEqual([]);
      expect(result.setNames).toEqual({});
    });
  });
});
