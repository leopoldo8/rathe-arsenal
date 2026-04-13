import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  StoreEntity,
  StoreStockEntity,
  TrackedDeckEntity,
  DeckReadinessSnapshotEntity,
} from '../../database/entities';
import { ShoppingLineService } from '../shopping-line.service';
import { IBreakdown } from '../../decks/dtos/tracked-deck-detail.response.dto';
import {
  IShoppingLinePopulated,
  IShoppingLineResponse,
} from '../dtos/shopping-line.response.dto';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(overrides: Partial<StoreEntity> = {}): StoreEntity {
  return {
    id: 1,
    slug: 'cupula-dt',
    name: 'Cúpula DT',
    baseUrl: 'https://www.cupuladt.com.br',
    listingPath: '/?view=ecom/itens&tcg=8',
    rateLimitMs: 1500,
    active: true,
    lastScrapedAt: null,
    lastFetchedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as StoreEntity;
}

function makeStockRow(
  cardIdentifier: string,
  overrides: Partial<StoreStockEntity> = {},
): StoreStockEntity {
  return {
    id: 1,
    storeId: 1,
    cardIdentifier,
    priceCents: 4990,
    quantity: 3,
    productUrl: `https://www.cupuladt.com.br/?view=ecom/item&id=${cardIdentifier}`,
    productNameRaw: `Raw Name ${cardIdentifier}`,
    lastFetchedAt: new Date('2026-04-10T10:00:00Z'),
    store: {} as StoreEntity,
    ...overrides,
  } as StoreStockEntity;
}

function makeBreakdown(
  missing: Array<{ cardIdentifier: string; quantity: number }>,
): IBreakdown {
  const missingEntries = missing.map((e) => ({
    cardIdentifier: e.cardIdentifier,
    quantity: e.quantity,
    slot: 'mainboard',
  }));
  return {
    exact: [],
    substituted: [],
    missing: missingEntries,
    notOwned: missingEntries,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShoppingLineService', () => {
  let service: ShoppingLineService;
  let storeRepo: jest.Mocked<Repository<StoreEntity>>;
  let storeStockRepo: jest.Mocked<Repository<StoreStockEntity>>;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;

  beforeEach(async () => {
    storeRepo = createMock<Repository<StoreEntity>>();
    storeStockRepo = createMock<Repository<StoreStockEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShoppingLineService,
        {
          provide: getRepositoryToken(StoreEntity),
          useValue: storeRepo,
        },
        {
          provide: getRepositoryToken(StoreStockEntity),
          useValue: storeStockRepo,
        },
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
        {
          provide: getRepositoryToken(DeckReadinessSnapshotEntity),
          useValue: snapshotRepo,
        },
      ],
    }).compile();

    service = module.get<ShoppingLineService>(ShoppingLineService);
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // computeForBreakdown
  // -------------------------------------------------------------------------

  describe('computeForBreakdown', () => {
    it('returns null when missing array is empty (Path A)', async () => {
      // Arrange
      const breakdown = makeBreakdown([]);

      // Act
      const result = await service.computeForBreakdown(breakdown);

      // Assert
      expect(result).toBeNull();
      expect(storeRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns error when store is inactive or missing', async () => {
      // Arrange
      storeRepo.findOne.mockResolvedValue(null);
      const breakdown = makeBreakdown([
        { cardIdentifier: 'hammer-of-gravi-red', quantity: 1 },
      ]);

      // Act
      const result = await service.computeForBreakdown(breakdown);

      // Assert
      expect(result).toEqual({ kind: 'error', reason: 'store_missing' });
    });

    it('returns unscraped when store has no stock rows at all', async () => {
      // Arrange
      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([]); // no matching rows for identifiers
      storeStockRepo.count.mockResolvedValue(0); // no rows in the table at all

      const breakdown = makeBreakdown([
        { cardIdentifier: 'hammer-of-gravi-red', quantity: 1 },
      ]);

      // Act
      const result = await service.computeForBreakdown(breakdown);

      // Assert
      expect(result).toEqual({ kind: 'unscraped' });
    });

    it('happy path: all 5 cards in stock — populated result with correct totals', async () => {
      // Arrange
      const identifiers = [
        'hammer-of-gravi-red',
        'majestic-sword-blue',
        'iron-fists-yellow',
        'blazing-aether-red',
        'nimble-strike-blue',
      ];

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue(
        identifiers.map((id, i) =>
          makeStockRow(id, {
            id: i + 1,
            priceCents: (i + 1) * 1000,
            quantity: 5,
          }),
        ),
      );

      const breakdown = makeBreakdown(
        identifiers.map((id) => ({ cardIdentifier: id, quantity: 1 })),
      );

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.kind).toBe('populated');
      expect(result.availableCardCount).toBe(5);
      expect(result.unavailableCardCount).toBe(0);
      // 1000 + 2000 + 3000 + 4000 + 5000 = 15000
      expect(result.totalCostCents).toBe(15000);
      expect(result.lines).toHaveLength(5);
      expect(result.storeName).toBe('Cúpula DT');
      expect(result.storeSlug).toBe('cupula-dt');
      expect(result.storeHostname).toBe('www.cupuladt.com.br');
    });

    it('happy path: 3 of 5 cards in stock — partial result', async () => {
      // Arrange
      const allIds = [
        'hammer-of-gravi-red',
        'majestic-sword-blue',
        'iron-fists-yellow',
        'blazing-aether-red',
        'nimble-strike-blue',
      ];
      const inStockIds = allIds.slice(0, 3);

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue(
        inStockIds.map((id, i) => makeStockRow(id, { id: i + 1, priceCents: 2000, quantity: 2 })),
      );

      const breakdown = makeBreakdown(
        allIds.map((id) => ({ cardIdentifier: id, quantity: 1 })),
      );

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.kind).toBe('populated');
      expect(result.availableCardCount).toBe(3);
      expect(result.unavailableCardCount).toBe(2);
      expect(result.totalCostCents).toBe(6000); // 3 × 2000
    });

    it('happy path: quantity needed 2, stock has only 1 — partial quantity', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([
        makeStockRow(cardId, { priceCents: 5000, quantity: 1 }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 2 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.kind).toBe('populated');
      expect(result.lines[0]!.quantityNeeded).toBe(2);
      expect(result.lines[0]!.quantityAvailable).toBe(1); // min(2, 1)
      expect(result.totalCostCents).toBe(5000); // 1 × 5000
    });

    it('edge case: all missing cards unavailable — totalCostCents = 0', async () => {
      // Arrange
      storeRepo.findOne.mockResolvedValue(makeStore());
      // No rows found for missing cards but store has some stock
      storeStockRepo.find.mockResolvedValue([]);
      storeStockRepo.count.mockResolvedValue(42); // store has stock for other cards

      const breakdown = makeBreakdown([
        { cardIdentifier: 'hammer-of-gravi-red', quantity: 1 },
        { cardIdentifier: 'majestic-sword-blue', quantity: 1 },
      ]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.kind).toBe('populated');
      expect(result.totalCostCents).toBe(0);
      expect(result.availableCardCount).toBe(0);
      expect(result.unavailableCardCount).toBe(2);
    });

    it('edge case: stock row has priceCents = null — excluded from available count', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([
        makeStockRow(cardId, { priceCents: null, quantity: 3 }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.kind).toBe('populated');
      expect(result.availableCardCount).toBe(0);
      expect(result.unavailableCardCount).toBe(1);
      expect(result.totalCostCents).toBe(0);
    });

    it('lines are sorted: available first, then by price ascending, then by name', async () => {
      // Arrange
      const rows = [
        makeStockRow('card-c', { id: 3, priceCents: 1000, quantity: 2 }),
        makeStockRow('card-a', { id: 1, priceCents: 3000, quantity: 2 }),
        makeStockRow('card-b', { id: 2, priceCents: 1000, quantity: 2 }),
        // card-d will be unavailable (no stock row)
      ];

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue(rows);
      storeStockRepo.count.mockResolvedValue(42);

      const breakdown = makeBreakdown([
        { cardIdentifier: 'card-d', quantity: 1 },
        { cardIdentifier: 'card-a', quantity: 1 },
        { cardIdentifier: 'card-b', quantity: 1 },
        { cardIdentifier: 'card-c', quantity: 1 },
      ]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert — available first (cards a, b, c before d),
      // then price asc (b and c at 1000 before a at 3000),
      // then name asc (b before c)
      const ids = result.lines.map((l) => l.cardIdentifier);
      const availableIds = result.lines
        .filter((l) => l.quantityAvailable > 0)
        .map((l) => l.cardIdentifier);
      const unavailableIds = result.lines
        .filter((l) => l.quantityAvailable === 0)
        .map((l) => l.cardIdentifier);

      expect(unavailableIds).toEqual(['card-d']);
      // All available lines come before unavailable ones.
      const firstUnavailableIndex = ids.indexOf('card-d');
      for (const id of availableIds) {
        expect(ids.indexOf(id)).toBeLessThan(firstUnavailableIndex);
      }

      // Among available: price asc order (b and c at 1000 before a at 3000)
      expect(ids.indexOf('card-a')).toBeGreaterThan(ids.indexOf('card-b'));
      expect(ids.indexOf('card-a')).toBeGreaterThan(ids.indexOf('card-c'));
    });

    it('lastFetchedAt on the envelope is the oldest across all available lines', async () => {
      // Arrange — two lines, different lastFetchedAt
      const olderDate = new Date('2026-04-08T00:00:00Z');
      const newerDate = new Date('2026-04-10T00:00:00Z');

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([
        makeStockRow('card-a', { id: 1, lastFetchedAt: newerDate }),
        makeStockRow('card-b', { id: 2, lastFetchedAt: olderDate }),
      ]);

      const breakdown = makeBreakdown([
        { cardIdentifier: 'card-a', quantity: 1 },
        { cardIdentifier: 'card-b', quantity: 1 },
      ]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert — envelope carries the OLDER date (worst-case freshness)
      expect(result.lastFetchedAt).toBe(olderDate.toISOString());
    });

    it('S10: productUrl with wrong hostname is blanked with a warning', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([
        makeStockRow(cardId, {
          productUrl: 'https://evil.com/?view=ecom/item&id=123',
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert — productUrl is blanked because hostname does not match
      expect(result.lines[0]!.productUrl).toBe('');
    });

    it('S10: productUrl with non-https scheme is blanked', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([
        makeStockRow(cardId, {
          productUrl: 'http://www.cupuladt.com.br/?view=ecom/item&id=123',
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.lines[0]!.productUrl).toBe('');
    });

    it('S10: valid productUrl passes the hostname check unchanged', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      const validUrl = 'https://www.cupuladt.com.br/?view=ecom/item&id=42';

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([
        makeStockRow(cardId, { productUrl: validUrl }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.lines[0]!.productUrl).toBe(validUrl);
    });

    it('returns populated with empty upgradeCandidates when no rawBreakdown is provided', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([makeStockRow(cardId)]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.kind).toBe('populated');
      expect(result.upgradeCandidates).toEqual([]);
    });

    it('handles DB error — returns error kind', async () => {
      // Arrange
      storeRepo.findOne.mockRejectedValue(new Error('DB connection lost'));
      const breakdown = makeBreakdown([
        { cardIdentifier: 'hammer-of-gravi-red', quantity: 1 },
      ]);

      // Act
      const result = await service.computeForBreakdown(breakdown);

      // Assert
      expect(result).toEqual({ kind: 'error', reason: 'db_error' });
    });

    it('regression: substituted cards do NOT appear in the primary lines', async () => {
      // The spec says breakdown.missing does not include substituted cards.
      // This test confirms the service does not add them to lines.
      const missingId = 'hammer-of-gravi-red';
      const substitutedOriginalId = 'iron-fists-yellow';

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([
        makeStockRow(missingId),
        makeStockRow(substitutedOriginalId),
      ]);

      // breakdown.missing only contains missingId; substituted card's original
      // is in breakdown.substituted but not in breakdown.missing.
      const breakdown: IBreakdown = {
        exact: [],
        substituted: [
          {
            cardIdentifier: substitutedOriginalId,
            quantity: 1,
            slot: 'mainboard',
          },
        ],
        missing: [{ cardIdentifier: missingId, quantity: 1, slot: 'mainboard' }],
        notOwned: [
          { cardIdentifier: missingId, quantity: 1, slot: 'mainboard' },
          { cardIdentifier: substitutedOriginalId, quantity: 1, slot: 'mainboard' },
        ],
      };

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert — only missingId in lines
      expect(result.lines.map((l) => l.cardIdentifier)).toEqual([missingId]);
    });
  });

  // -------------------------------------------------------------------------
  // computeAggregate
  // -------------------------------------------------------------------------

  describe('computeAggregate', () => {
    const USER_ID = 'user-uuid-abc';

    it('returns null when store is missing or inactive', async () => {
      // Arrange
      storeRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await service.computeAggregate(USER_ID);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when store has no stock rows (unscraped)', async () => {
      // Arrange
      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.count.mockResolvedValue(0);

      // Act
      const result = await service.computeAggregate(USER_ID);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when user has no tracked decks', async () => {
      // Arrange
      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.count.mockResolvedValue(100);
      trackedDeckRepo.find.mockResolvedValue([]);

      // Act
      const result = await service.computeAggregate(USER_ID);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null when no decks have missing cards', async () => {
      // Arrange
      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.count.mockResolvedValue(100);
      trackedDeckRepo.find.mockResolvedValue([
        { id: 1, userId: USER_ID } as TrackedDeckEntity,
      ]);

      const mockQb = createMock<SelectQueryBuilder<DeckReadinessSnapshotEntity>>();
      snapshotRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockQb.where.mockReturnThis();
      mockQb.andWhere.mockReturnThis();
      mockQb.getMany.mockResolvedValue([
        {
          id: 10,
          trackedDeckId: 1,
          effectivePercent: 100,
          breakdown: { exact: [{ cardIdentifier: 'x', quantity: 1, slot: 'mainboard' }], substituted: [], missing: [] },
          substitutions: {},
          computedAt: new Date(),
        } as unknown as DeckReadinessSnapshotEntity,
      ]);

      // Act
      const result = await service.computeAggregate(USER_ID);

      // Assert
      expect(result).toBeNull();
    });

    it('returns aggregate with correct cost and completable count', async () => {
      // Arrange
      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.count.mockResolvedValue(100);
      trackedDeckRepo.find.mockResolvedValue([
        { id: 1, userId: USER_ID } as TrackedDeckEntity,
        { id: 2, userId: USER_ID } as TrackedDeckEntity,
      ]);

      const mockQb = createMock<SelectQueryBuilder<DeckReadinessSnapshotEntity>>();
      snapshotRepo.createQueryBuilder.mockReturnValue(mockQb);
      mockQb.where.mockReturnThis();
      mockQb.andWhere.mockReturnThis();
      mockQb.getMany.mockResolvedValue([
        {
          id: 10,
          trackedDeckId: 1,
          effectivePercent: 70,
          breakdown: {
            exact: [],
            substituted: [],
            missing: [{ cardIdentifier: 'card-a', quantity: 1, slot: 'mainboard' }],
          },
          substitutions: {},
          computedAt: new Date(),
        } as unknown as DeckReadinessSnapshotEntity,
        {
          id: 11,
          trackedDeckId: 2,
          effectivePercent: 50,
          breakdown: {
            exact: [],
            substituted: [],
            missing: [
              { cardIdentifier: 'card-b', quantity: 2, slot: 'mainboard' },
              { cardIdentifier: 'card-c', quantity: 1, slot: 'mainboard' },
            ],
          },
          substitutions: {},
          computedAt: new Date(),
        } as unknown as DeckReadinessSnapshotEntity,
      ]);

      // card-a: in stock (completable deck 1), card-b: in stock qty 1 (partial, not completable),
      // card-c: not in stock
      storeStockRepo.find.mockResolvedValue([
        makeStockRow('card-a', { priceCents: 3000, quantity: 5 }),
        makeStockRow('card-b', { priceCents: 2000, quantity: 1 }), // only qty 1, need 2 → not completable
      ]);

      // Act
      const result = await service.computeAggregate(USER_ID);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.storeName).toBe('Cúpula DT');
      expect(result!.storeSlug).toBe('cupula-dt');
      // deck 1: 1 × 3000 = 3000; deck 2: min(2,1) × 2000 = 2000; total = 5000
      expect(result!.totalCostCents).toBe(5000);
      // deck 1 completable (card-a all covered), deck 2 not (card-b partial, card-c missing)
      expect(result!.decksCompletable).toBe(1);
      expect(result!.totalDecks).toBe(2);
    });

    it('handles DB error gracefully — returns null', async () => {
      // Arrange
      storeRepo.findOne.mockRejectedValue(new Error('DB error'));

      // Act
      const result = await service.computeAggregate(USER_ID);

      // Assert
      expect(result).toBeNull();
    });
  });
});
