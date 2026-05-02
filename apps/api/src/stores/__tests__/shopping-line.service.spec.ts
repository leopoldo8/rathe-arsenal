import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  StoreEntity,
  StoreStockEntity,
  StoreStockVariantEntity,
  TrackedDeckEntity,
  DeckReadinessSnapshotEntity,
} from '../../database/entities';
import { ShoppingLineService } from '../shopping-line.service';
import { IBreakdown } from '../../decks/dtos/tracked-deck-detail.response.dto';
import {
  EVariantVerificationStatus,
  IShoppingLinePopulated,
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

function makeVariantRow(
  cardIdentifier: string,
  overrides: Partial<StoreStockVariantEntity> = {},
): StoreStockVariantEntity {
  return {
    id: 1,
    storeId: 1,
    cardIdentifier,
    edition: 'HVY',
    condition: 'NM',
    finish: 'non-foil',
    priceCents: 35,
    quantity: 5,
    detailFetchedAt: new Date('2026-04-11T10:00:00Z'),
    // Snapshot matches the default makeStockRow values (priceCents=4990, qty=3)
    listingPriceCentsSnapshot: 4990,
    listingQuantitySnapshot: 3,
    store: {} as StoreEntity,
    ...overrides,
  } as StoreStockVariantEntity;
}

function makeBreakdown(
  missing: Array<{ cardIdentifier: string; quantity: number }>,
): IBreakdown {
  // U11: IBreakdownEntry now requires pitch, cost, type.
  // Tests use null/null/'ally' defaults — contextually appropriate for mainboard action cards.
  const missingEntries = missing.map((e) => ({
    cardIdentifier: e.cardIdentifier,
    quantity: e.quantity,
    slot: 'mainboard',
    pitch: null as 1 | 2 | 3 | null,
    cost: null as number | null,
    type: 'ally',
    imageUrl: null,
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
  let storeStockVariantRepo: jest.Mocked<Repository<StoreStockVariantEntity>>;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;

  beforeEach(async () => {
    storeRepo = createMock<Repository<StoreEntity>>();
    storeStockRepo = createMock<Repository<StoreStockEntity>>();
    storeStockVariantRepo = createMock<Repository<StoreStockVariantEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();

    // Default: no variant rows (backward-compatible baseline).
    storeStockVariantRepo.find.mockResolvedValue([]);

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
          provide: getRepositoryToken(StoreStockVariantEntity),
          useValue: storeStockVariantRepo,
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

    // -----------------------------------------------------------------------
    // Variant integration tests (Unit 4)
    // -----------------------------------------------------------------------

    it('variant T1: card with 3 variants, need 2 copies — allocates cheapest first', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      // Stock row: price=4990, qty=3 (listing baseline)
      const stock = makeStockRow(cardId, { priceCents: 4990, quantity: 3 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([stock]);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(cardId, {
          id: 1,
          edition: 'HVY',
          condition: 'NM',
          finish: 'non-foil',
          priceCents: 35,
          quantity: 1,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 3,
        }),
        makeVariantRow(cardId, {
          id: 2,
          edition: 'HVY',
          condition: 'NM',
          finish: 'foil',
          priceCents: 390,
          quantity: 2,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 3,
        }),
        makeVariantRow(cardId, {
          id: 3,
          edition: 'HVY',
          condition: 'LP',
          finish: 'non-foil',
          priceCents: 990,
          quantity: 5,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 3,
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 2 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: allocates cheapest first — 1@35 + 1@390 = 425
      expect(result.kind).toBe('populated');
      expect(result.lines[0]!.quantityAvailable).toBe(2);
      expect(result.lines[0]!.lineCostCents).toBe(425); // 1×35 + 1×390
      expect(result.totalCostCents).toBe(425);
      expect(result.lines[0]!.unitPriceCents).toBe(35); // cheapest variant
      expect(result.lines[0]!.hasVariantData).toBe(true);
      expect(result.lines[0]!.dataSource).toBe('variant');
      expect(result.isEstimated).toBe(false);
    });

    it('variant T2: R12 example — need 3, A has 1@35c, B has 2@350c — cost = 735', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      const stock = makeStockRow(cardId, { priceCents: 4990, quantity: 3 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([stock]);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(cardId, {
          id: 1,
          priceCents: 35,
          quantity: 1,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 3,
        }),
        makeVariantRow(cardId, {
          id: 2,
          finish: 'foil',
          priceCents: 350,
          quantity: 2,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 3,
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 3 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: 1×35 + 2×350 = 35 + 700 = 735
      expect(result.kind).toBe('populated');
      expect(result.lines[0]!.quantityAvailable).toBe(3);
      expect(result.lines[0]!.lineCostCents).toBe(735);
      expect(result.totalCostCents).toBe(735);
    });

    it('variant T3: all cards have fresh variant data — isEstimated = false', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      const stock = makeStockRow(cardId, { priceCents: 4990, quantity: 3 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([stock]);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(cardId, {
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 3,
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.isEstimated).toBe(false);
      expect(result.lines[0]!.hasVariantData).toBe(true);
    });

    it('variant T4: mix of variant and listing data — isEstimated = true, each uses its source', async () => {
      // Arrange
      const variantCardId = 'hammer-of-gravi-red';
      const listingCardId = 'majestic-sword-blue';

      const variantStock = makeStockRow(variantCardId, { id: 1, priceCents: 4990, quantity: 3 });
      const listingStock = makeStockRow(listingCardId, { id: 2, priceCents: 2000, quantity: 2 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([variantStock, listingStock]);
      // Only variantCardId has variant data
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(variantCardId, {
          priceCents: 35,
          quantity: 5,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 3,
        }),
      ]);

      const breakdown = makeBreakdown([
        { cardIdentifier: variantCardId, quantity: 1 },
        { cardIdentifier: listingCardId, quantity: 1 },
      ]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.isEstimated).toBe(true);

      const variantLine = result.lines.find((l) => l.cardIdentifier === variantCardId)!;
      expect(variantLine.hasVariantData).toBe(true);
      expect(variantLine.dataSource).toBe('variant');
      expect(variantLine.unitPriceCents).toBe(35);

      const listingLine = result.lines.find((l) => l.cardIdentifier === listingCardId)!;
      expect(listingLine.hasVariantData).toBe(false);
      expect(listingLine.dataSource).toBe('listing');
      expect(listingLine.unitPriceCents).toBe(2000);
    });

    it('variant T5: stale variant data (snapshot mismatch) — falls back to listing', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      // Current listing has priceCents=6000 but snapshot says 4990 → stale
      const stock = makeStockRow(cardId, { priceCents: 6000, quantity: 3 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([stock]);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(cardId, {
          priceCents: 35,
          quantity: 5,
          listingPriceCentsSnapshot: 4990, // mismatch: current listing is 6000
          listingQuantitySnapshot: 3,
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: stale → listing fallback
      expect(result.lines[0]!.hasVariantData).toBe(false);
      expect(result.lines[0]!.dataSource).toBe('listing');
      expect(result.lines[0]!.unitPriceCents).toBe(6000);
      expect(result.isEstimated).toBe(true);
    });

    it('variant T5b: stale variant data (quantity-only mismatch) — falls back to listing', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      // Current listing has quantity=5 but snapshot says 3 → stale even though price matches
      const stock = makeStockRow(cardId, { priceCents: 4990, quantity: 5 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([stock]);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(cardId, {
          priceCents: 35,
          quantity: 3,
          listingPriceCentsSnapshot: 4990, // price matches current listing
          listingQuantitySnapshot: 3,       // quantity mismatch: current is 5
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: stale → listing fallback (quantity mismatch triggers staleness)
      expect(result.lines[0]!.hasVariantData).toBe(false);
      expect(result.lines[0]!.dataSource).toBe('listing');
      expect(result.lines[0]!.unitPriceCents).toBe(4990);
      expect(result.isEstimated).toBe(true);
    });

    it('variant T6: R12a — need 3, total variant qty = 1 — partially available', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      const stock = makeStockRow(cardId, { priceCents: 4990, quantity: 1 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([stock]);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(cardId, {
          priceCents: 35,
          quantity: 1, // only 1 available, need 3
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 1,
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 3 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: quantityAvailable = 1 (all that's available), cost = 1×35
      expect(result.lines[0]!.quantityAvailable).toBe(1);
      expect(result.lines[0]!.lineCostCents).toBe(35);
      expect(result.lines[0]!.quantityNeeded).toBe(3);
      expect(result.lines[0]!.hasVariantData).toBe(true);
    });

    it('variant T7: R12b — variant rows exist with qty=0 — verificationStatus = verified_zero', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      const stock = makeStockRow(cardId, { priceCents: 4990, quantity: 0 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([stock]);
      storeStockRepo.count.mockResolvedValue(42);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(cardId, {
          priceCents: 35,
          quantity: 0, // verified zero
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 0,
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert
      expect(result.lines[0]!.quantityAvailable).toBe(0);
      expect(result.lines[0]!.lineCostCents).toBe(0);
      expect(result.lines[0]!.verificationStatus).toBe(EVariantVerificationStatus.VERIFIED_ZERO);
      expect(result.lines[0]!.hasVariantData).toBe(true);
      expect(result.lines[0]!.dataSource).toBe('variant');
    });

    it('variant T8: all variant priceCents are null — falls back to listing', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      const stock = makeStockRow(cardId, { priceCents: 4990, quantity: 3 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([stock]);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(cardId, {
          priceCents: null as unknown as number,
          quantity: 3,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 3,
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: falls back to listing because variant has null price
      expect(result.lines[0]!.hasVariantData).toBe(false);
      expect(result.lines[0]!.dataSource).toBe('listing');
      expect(result.lines[0]!.unitPriceCents).toBe(4990);
    });

    it('variant T9 integration: totalCostCents sums correctly across mix of variant and listing cards', async () => {
      // Arrange
      const variantCardId = 'hammer-of-gravi-red';
      const listingCardId = 'majestic-sword-blue';

      const variantStock = makeStockRow(variantCardId, { id: 1, priceCents: 4990, quantity: 3 });
      const listingStock = makeStockRow(listingCardId, { id: 2, priceCents: 2000, quantity: 2 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([variantStock, listingStock]);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(variantCardId, {
          priceCents: 35,
          quantity: 5,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 3,
        }),
      ]);

      const breakdown = makeBreakdown([
        { cardIdentifier: variantCardId, quantity: 2 },
        { cardIdentifier: listingCardId, quantity: 1 },
      ]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: variant card: 2×35=70; listing card: 1×2000=2000; total=2070
      expect(result.totalCostCents).toBe(2070);
    });

    it('variant T10 regression: no variant data — behavior identical to pre-variant', async () => {
      // Arrange: default storeStockVariantRepo.find returns [] (set in beforeEach)
      const identifiers = ['hammer-of-gravi-red', 'majestic-sword-blue'];
      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue(
        identifiers.map((id, i) =>
          makeStockRow(id, { id: i + 1, priceCents: (i + 1) * 1000, quantity: 2 }),
        ),
      );

      const breakdown = makeBreakdown(
        identifiers.map((id) => ({ cardIdentifier: id, quantity: 1 })),
      );

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: same as pre-variant — listing prices, isEstimated = true
      expect(result.kind).toBe('populated');
      expect(result.isEstimated).toBe(true);
      expect(result.totalCostCents).toBe(3000); // 1×1000 + 1×2000
      for (const line of result.lines) {
        expect(line.hasVariantData).toBe(false);
        expect(line.dataSource).toBe('listing');
        expect(line.lineCostCents).toBe(line.quantityAvailable * (line.unitPriceCents ?? 0));
      }
    });

    it('variant T11: lineCostCents is populated for both variant and listing cards', async () => {
      // Arrange
      const variantCardId = 'hammer-of-gravi-red';
      const listingCardId = 'majestic-sword-blue';
      const variantStock = makeStockRow(variantCardId, { id: 1, priceCents: 4990, quantity: 3 });
      const listingStock = makeStockRow(listingCardId, { id: 2, priceCents: 1500, quantity: 2 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([variantStock, listingStock]);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(variantCardId, {
          priceCents: 100,
          quantity: 3,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 3,
        }),
      ]);

      const breakdown = makeBreakdown([
        { cardIdentifier: variantCardId, quantity: 1 },
        { cardIdentifier: listingCardId, quantity: 1 },
      ]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: both lines have lineCostCents defined
      for (const line of result.lines) {
        expect(typeof line.lineCostCents).toBe('number');
      }
      const variantLine = result.lines.find((l) => l.cardIdentifier === variantCardId)!;
      expect(variantLine.lineCostCents).toBe(100); // 1×100
      const listingLine = result.lines.find((l) => l.cardIdentifier === listingCardId)!;
      expect(listingLine.lineCostCents).toBe(1500); // 1×1500
    });

    it('variant T12: multi-tier — need 5; A has 2@10c, B has 1@50c, C has 3@100c — 270c total', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      const stock = makeStockRow(cardId, { priceCents: 4990, quantity: 6 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([stock]);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(cardId, {
          id: 1,
          edition: 'HVY',
          condition: 'NM',
          finish: 'non-foil',
          priceCents: 100,
          quantity: 3,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 6,
        }),
        makeVariantRow(cardId, {
          id: 2,
          edition: 'HVY',
          condition: 'NM',
          finish: 'foil',
          priceCents: 50,
          quantity: 1,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 6,
        }),
        makeVariantRow(cardId, {
          id: 3,
          edition: 'HVY',
          condition: 'LP',
          finish: 'non-foil',
          priceCents: 10,
          quantity: 2,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 6,
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 5 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: greedy cheapest first: 2@10 + 1@50 + 2@100 = 20 + 50 + 200 = 270
      expect(result.lines[0]!.quantityAvailable).toBe(5);
      expect(result.lines[0]!.lineCostCents).toBe(270);
      expect(result.totalCostCents).toBe(270);
      expect(result.lines[0]!.verificationStatus).toBeUndefined();
      expect(result.lines[0]!.unitPriceCents).toBe(10); // cheapest
    });

    it('variant T13: verified_zero populates correctly with variant data present', async () => {
      // Arrange
      const cardId = 'hammer-of-gravi-red';
      const stock = makeStockRow(cardId, { priceCents: 4990, quantity: 0 });

      storeRepo.findOne.mockResolvedValue(makeStore());
      storeStockRepo.find.mockResolvedValue([stock]);
      storeStockRepo.count.mockResolvedValue(42);
      storeStockVariantRepo.find.mockResolvedValue([
        makeVariantRow(cardId, {
          id: 1,
          edition: 'HVY',
          condition: 'NM',
          finish: 'non-foil',
          priceCents: 35,
          quantity: 0,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 0,
        }),
        makeVariantRow(cardId, {
          id: 2,
          edition: 'HVY',
          condition: 'NM',
          finish: 'foil',
          priceCents: 390,
          quantity: 0,
          listingPriceCentsSnapshot: 4990,
          listingQuantitySnapshot: 0,
        }),
      ]);

      const breakdown = makeBreakdown([{ cardIdentifier: cardId, quantity: 1 }]);

      // Act
      const result = await service.computeForBreakdown(breakdown) as IShoppingLinePopulated;

      // Assert: R12b — verified_zero with correct fields
      expect(result.lines[0]!.hasVariantData).toBe(true);
      expect(result.lines[0]!.dataSource).toBe('variant');
      expect(result.lines[0]!.quantityAvailable).toBe(0);
      expect(result.lines[0]!.lineCostCents).toBe(0);
      expect(result.lines[0]!.verificationStatus).toBe(EVariantVerificationStatus.VERIFIED_ZERO);
      expect(result.lines[0]!.variants).toHaveLength(2);
      expect(result.totalCostCents).toBe(0);
      expect(result.unavailableCardCount).toBe(1);
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
      // U11: IBreakdownEntry requires pitch, cost, type.
      const breakdown: IBreakdown = {
        exact: [],
        substituted: [
          {
            cardIdentifier: substitutedOriginalId,
            quantity: 1,
            slot: 'mainboard',
            pitch: null,
            cost: null,
            type: 'ally',
            imageUrl: null,
          },
        ],
        missing: [{ cardIdentifier: missingId, quantity: 1, slot: 'mainboard', pitch: null, cost: null, type: 'ally', imageUrl: null }],
        notOwned: [
          { cardIdentifier: missingId, quantity: 1, slot: 'mainboard', pitch: null, cost: null, type: 'ally', imageUrl: null },
          { cardIdentifier: substitutedOriginalId, quantity: 1, slot: 'mainboard', pitch: null, cost: null, type: 'ally', imageUrl: null },
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

    it('(U10) returns aggregate with kind=unscraped when store has no stock rows', async () => {
      // Arrange: store exists but anyStock === 0 — unscraped state.
      // We also need decks + snapshots with missing cards to get a non-null response.
      storeRepo.findOne.mockResolvedValue(makeStore());
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
          effectivePercent: 50,
          breakdown: {
            exact: [],
            substituted: [],
            missing: [{ cardIdentifier: 'card-x', quantity: 1, slot: 'mainboard' }],
          },
          substitutions: {},
          computedAt: new Date(),
        } as unknown as DeckReadinessSnapshotEntity,
      ]);
      // No stock rows at all
      storeStockRepo.count.mockResolvedValue(0);

      // Act
      const result = await service.computeAggregate(USER_ID);

      // Assert: non-null with kind='unscraped' so frontend render guard fires.
      expect(result).not.toBeNull();
      expect(result!.kind).toBe('unscraped');
      expect(result!.totalCostCents).toBe(0);
      expect(result!.completableDecks).toBe(0);
      expect(result!.uniqueCardsMissing).toBe(1);
    });

    it('returns null when user has no tracked decks', async () => {
      // Arrange
      storeRepo.findOne.mockResolvedValue(makeStore());
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
      expect(result!.completableDecks).toBe(1);
      expect(result!.totalDecks).toBe(2);
      // (U10) kind and uniqueCardsMissing
      expect(result!.kind).toBe('populated');
      expect(result!.uniqueCardsMissing).toBe(3); // card-a, card-b, card-c
    });

    it('handles DB error gracefully — returns null', async () => {
      // Arrange
      storeRepo.findOne.mockRejectedValue(new Error('DB error'));

      // Act
      const result = await service.computeAggregate(USER_ID);

      // Assert
      expect(result).toBeNull();
    });

    it('regression: single missing card with stock.quantity < needed is NOT completable', async () => {
      // Arrange — only one missing card; stock exists but cannot cover the full quantity.
      // Without the fix, allMissingCovered stays true and the deck is wrongly counted as completable.
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
          effectivePercent: 80,
          breakdown: {
            exact: [],
            substituted: [],
            missing: [{ cardIdentifier: 'card-a', quantity: 3, slot: 'mainboard' }],
          },
          substitutions: {},
          computedAt: new Date(),
        } as unknown as DeckReadinessSnapshotEntity,
      ]);

      storeStockRepo.find.mockResolvedValue([
        makeStockRow('card-a', { priceCents: 1000, quantity: 1 }), // need 3, only 1 available
      ]);

      // Act
      const result = await service.computeAggregate(USER_ID);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.completableDecks).toBe(0);
      expect(result!.totalDecks).toBe(1);
      // partial cost: min(3, 1) × 1000 = 1000
      expect(result!.totalCostCents).toBe(1000);
    });
  });
});
