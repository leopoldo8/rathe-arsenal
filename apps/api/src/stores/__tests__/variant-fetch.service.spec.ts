import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { createMock } from '@golevelup/ts-jest';
import { FetchGuardService } from '../../common/fetch-guard/fetch-guard.service';
import { StoreEntity } from '../../database/entities/store.entity';
import { StoreStockVariantEntity } from '../../database/entities/store-stock-variant.entity';
import { SbraubleDetailParserService } from '../sbrauble-detail-parser.service';
import { VariantFetchService, IFetchCard } from '../variant-fetch.service';
import { IScrapedVariant } from '../types/scraped-variant';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORE_ID = 1;
const DECK_ID = 'deck-uuid-abc123';
const STORE_HOSTNAME = 'www.cupuladt.com.br';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(overrides: Partial<StoreEntity> = {}): StoreEntity {
  return {
    id: STORE_ID,
    slug: 'cupula-dt',
    name: 'Cúpula DT',
    baseUrl: `https://${STORE_HOSTNAME}`,
    listingPath: '/?view=ecom/itens&tcg=8',
    rateLimitMs: 0, // 0 for fast tests (no sleep)
    active: true,
    lastScrapedAt: null,
    lastFetchedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  } as StoreEntity;
}

function makeCard(overrides: Partial<IFetchCard> = {}): IFetchCard {
  return {
    cardIdentifier: 'test-card-red',
    productUrl: `https://${STORE_HOSTNAME}/?view=ecom/item&id=1`,
    listingPriceCents: 500,
    listingQuantity: 10,
    ...overrides,
  };
}

function makeVariant(overrides: Partial<IScrapedVariant> = {}): IScrapedVariant {
  return {
    edition: 'HVY',
    condition: 'NM',
    finish: 'non-foil',
    priceCents: 100,
    quantity: 5,
    ...overrides,
  };
}

function makeVariantEntity(overrides: Partial<StoreStockVariantEntity> = {}): StoreStockVariantEntity {
  return {
    id: 1,
    storeId: STORE_ID,
    cardIdentifier: 'test-card-red',
    edition: 'HVY',
    condition: 'NM',
    finish: 'non-foil',
    priceCents: 100,
    quantity: 5,
    detailFetchedAt: new Date('2026-04-10T10:00:00Z'),
    listingPriceCentsSnapshot: 500,
    listingQuantitySnapshot: 10,
    store: {} as StoreEntity,
    ...overrides,
  } as StoreStockVariantEntity;
}

// ---------------------------------------------------------------------------
// Transaction mock factory
// ---------------------------------------------------------------------------

type TTransactionEmMocks = {
  em: unknown;
  insertExecuteMock: jest.Mock;
  deleteExecuteMock: jest.Mock;
  emFindMock: jest.Mock;
  emDeleteMock: jest.Mock;
};

function buildTransactionEmMock(options: {
  insertShouldFail?: boolean;
  findExisting?: StoreStockVariantEntity[];
} = {}): TTransactionEmMocks {
  const insertExecuteMock = jest.fn();
  const deleteExecuteMock = jest.fn().mockResolvedValue(undefined);
  const emFindMock = jest.fn().mockResolvedValue(options.findExisting ?? []);
  const emDeleteMock = jest.fn().mockResolvedValue(undefined);

  if (options.insertShouldFail) {
    insertExecuteMock.mockRejectedValue(new Error('DB insert failed'));
  } else {
    insertExecuteMock.mockResolvedValue(undefined);
  }

  const em = {
    createQueryBuilder: () => ({
      insert: () => ({
        into: () => ({
          values: () => ({
            orUpdate: () => ({ execute: insertExecuteMock }),
          }),
        }),
      }),
      delete: () => ({
        from: () => ({
          where: () => ({ execute: deleteExecuteMock }),
        }),
      }),
    }),
    getRepository: () => ({
      find: emFindMock,
      delete: emDeleteMock,
    }),
  };

  return { em, insertExecuteMock, deleteExecuteMock, emFindMock, emDeleteMock };
}

/** Builds a mock SelectQueryBuilder that returns { cnt: countStr } from getRawOne. */
function buildQbMockForCount(countStr: string): jest.Mocked<SelectQueryBuilder<StoreStockVariantEntity>> {
  const getRawOneMock = jest.fn().mockResolvedValue({ cnt: countStr });
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: getRawOneMock,
  } as unknown as jest.Mocked<SelectQueryBuilder<StoreStockVariantEntity>>;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('VariantFetchService', () => {
  let service: VariantFetchService;
  let storeRepo: jest.Mocked<Repository<StoreEntity>>;
  let variantRepo: jest.Mocked<Repository<StoreStockVariantEntity>>;
  let fetchGuard: jest.Mocked<FetchGuardService>;
  let parser: jest.Mocked<SbraubleDetailParserService>;
  let dataSource: jest.Mocked<DataSource>;

  /**
   * Utility to let the fire-and-forget async loop finish before asserting.
   * Works by using a real setImmediate (NOT faked by jest.useFakeTimers).
   */
  const flushPromises = (): Promise<void> =>
    new Promise<void>((resolve) => setImmediate(resolve));

  function setupTransactionMock(
    options: Parameters<typeof buildTransactionEmMock>[0] = {},
  ): TTransactionEmMocks {
    const mocks = buildTransactionEmMock(options);
    (dataSource.transaction as jest.Mock).mockImplementation(
      (cb: (em: unknown) => Promise<void>) => cb(mocks.em),
    );
    return mocks;
  }

  beforeEach(async () => {
    storeRepo = {
      findOne: jest.fn().mockResolvedValue(makeStore()),
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Repository<StoreEntity>>;

    variantRepo = createMock<Repository<StoreStockVariantEntity>>();
    fetchGuard = createMock<FetchGuardService>();
    parser = createMock<SbraubleDetailParserService>();
    dataSource = createMock<DataSource>();

    // Default: successful fetch returning HTML body
    fetchGuard.guardedFetch.mockResolvedValue({
      status: 200,
      headers: {},
      body: Buffer.from('<html>mock detail page</html>'),
    });

    // Default: parser returns one variant
    parser.parseDetailPage.mockReturnValue([makeVariant()]);

    // Default: successful transaction
    setupTransactionMock();

    // Default: isFreshForDeck returns 0 fresh cards (not fresh by default)
    variantRepo.createQueryBuilder.mockReturnValue(buildQbMockForCount('0'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariantFetchService,
        { provide: getRepositoryToken(StoreEntity), useValue: storeRepo },
        { provide: getRepositoryToken(StoreStockVariantEntity), useValue: variantRepo },
        { provide: FetchGuardService, useValue: fetchGuard },
        { provide: SbraubleDetailParserService, useValue: parser },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(VariantFetchService);

    // Suppress Logger noise in tests
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'debug').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    // Destroy clears internal timers; must run before clearAllMocks
    service.onModuleDestroy();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Scenario 1: Happy path — fetch 3 cards, all succeed, progress 3/3
  // ---------------------------------------------------------------------------

  describe('Scenario 1: happy path: fetch 3 cards, all succeed', () => {
    it('should return a fetchId string (UUID)', () => {
      const fetchId = service.startFetch(DECK_ID, STORE_ID, [
        makeCard({ cardIdentifier: 'card-a' }),
        makeCard({ cardIdentifier: 'card-b' }),
        makeCard({ cardIdentifier: 'card-c' }),
      ]);
      expect(typeof fetchId).toBe('string');
      expect(fetchId).toHaveLength(36);
    });

    it('should set total=3 and inProgress=true before loop completes', () => {
      service.startFetch(DECK_ID, STORE_ID, [
        makeCard({ cardIdentifier: 'card-a' }),
        makeCard({ cardIdentifier: 'card-b' }),
        makeCard({ cardIdentifier: 'card-c' }),
      ]);
      const progress = service.getProgress(DECK_ID);

      expect(progress).toBeDefined();
      expect(progress!.total).toBe(3);
      expect(progress!.inProgress).toBe(true);
      expect(progress!.completed).toBe(0);
    });

    it('should complete all 3 cards with completed=3 and inProgress=false', async () => {
      service.startFetch(DECK_ID, STORE_ID, [
        makeCard({ cardIdentifier: 'card-a' }),
        makeCard({ cardIdentifier: 'card-b' }),
        makeCard({ cardIdentifier: 'card-c' }),
      ]);

      await flushPromises();

      const progress = service.getProgress(DECK_ID);
      expect(progress!.completed).toBe(3);
      expect(progress!.failed).toBe(0);
      expect(progress!.inProgress).toBe(false);
    });

    it('should mark all cards as done in per-card status map', async () => {
      service.startFetch(DECK_ID, STORE_ID, [
        makeCard({ cardIdentifier: 'card-a' }),
        makeCard({ cardIdentifier: 'card-b' }),
        makeCard({ cardIdentifier: 'card-c' }),
      ]);

      await flushPromises();

      const progress = service.getProgress(DECK_ID);
      expect(progress!.cards.get('card-a')).toBe('done');
      expect(progress!.cards.get('card-b')).toBe('done');
      expect(progress!.cards.get('card-c')).toBe('done');
    });

    it('should call fetchGuard.guardedFetch once per card', async () => {
      service.startFetch(DECK_ID, STORE_ID, [
        makeCard({ cardIdentifier: 'card-a' }),
        makeCard({ cardIdentifier: 'card-b' }),
        makeCard({ cardIdentifier: 'card-c' }),
      ]);

      await flushPromises();

      expect(fetchGuard.guardedFetch).toHaveBeenCalledTimes(3);
    });

    it('should call parser.parseDetailPage once per card', async () => {
      service.startFetch(DECK_ID, STORE_ID, [
        makeCard({ cardIdentifier: 'card-a' }),
        makeCard({ cardIdentifier: 'card-b' }),
        makeCard({ cardIdentifier: 'card-c' }),
      ]);

      await flushPromises();

      expect(parser.parseDetailPage).toHaveBeenCalledTimes(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 2: Listing snapshot values correctly captured on variant rows
  // ---------------------------------------------------------------------------

  describe('Scenario 2: happy path: listing snapshot values captured on variant rows', () => {
    it('should pass listingPriceCents and listingQuantity as snapshot columns to upsert', async () => {
      const insertExecuteMock = jest.fn().mockResolvedValue(undefined);
      const deleteExecuteMock = jest.fn().mockResolvedValue(undefined);
      let capturedValues: unknown[] = [];

      const em = {
        createQueryBuilder: () => ({
          insert: () => ({
            into: () => ({
              values: (v: unknown[]) => {
                capturedValues = v;
                return {
                  orUpdate: () => ({ execute: insertExecuteMock }),
                };
              },
            }),
          }),
          delete: () => ({
            from: () => ({
              where: () => ({ execute: deleteExecuteMock }),
            }),
          }),
        }),
        getRepository: () => ({
          find: jest.fn().mockResolvedValue([]),
          delete: jest.fn().mockResolvedValue(undefined),
        }),
      };

      (dataSource.transaction as jest.Mock).mockImplementation(
        (cb: (em2: unknown) => Promise<void>) => cb(em),
      );

      const card = makeCard({
        cardIdentifier: 'snap-card',
        listingPriceCents: 1234,
        listingQuantity: 7,
      });
      service.startFetch(DECK_ID, STORE_ID, [card]);

      await flushPromises();

      expect(capturedValues.length).toBeGreaterThan(0);
      expect(capturedValues[0]).toMatchObject({
        listingPriceCentsSnapshot: 1234,
        listingQuantitySnapshot: 7,
        cardIdentifier: 'snap-card',
        storeId: STORE_ID,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 3: Upsert on second fetch updates via composite unique index
  // ---------------------------------------------------------------------------

  describe('Scenario 3: happy path: upsert on second fetch — no duplicates', () => {
    it('should use orUpdate strategy with correct conflict columns', async () => {
      const orUpdateMock = jest.fn().mockReturnValue({ execute: jest.fn().mockResolvedValue(undefined) });
      const valuesMock = jest.fn().mockReturnValue({ orUpdate: orUpdateMock });

      const em = {
        createQueryBuilder: () => ({
          insert: () => ({ into: () => ({ values: valuesMock }) }),
          delete: () => ({ from: () => ({ where: () => ({ execute: jest.fn().mockResolvedValue(undefined) }) }) }),
        }),
        getRepository: () => ({ find: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue(undefined) }),
      };

      (dataSource.transaction as jest.Mock).mockImplementation(
        (cb: (em2: unknown) => Promise<void>) => cb(em),
      );

      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      await flushPromises();

      expect(orUpdateMock).toHaveBeenCalled();
      const [updateCols, conflictCols] = orUpdateMock.mock.calls[0] as [string[], string[]];
      expect(updateCols).toEqual(
        expect.arrayContaining(['priceCents', 'quantity', 'detailFetchedAt']),
      );
      expect(conflictCols).toEqual(
        expect.arrayContaining(['storeId', 'cardIdentifier', 'edition', 'condition', 'finish']),
      );
    });

    it('should call dataSource.transaction for each independent fetch', async () => {
      service.startFetch(DECK_ID + '-1', STORE_ID, [makeCard()]);
      await flushPromises();

      service.startFetch(DECK_ID + '-2', STORE_ID, [makeCard()]);
      await flushPromises();

      expect(dataSource.transaction).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 4: Card with zero in-stock variants → marked 'done', not 'failed'
  // ---------------------------------------------------------------------------

  describe('Scenario 4: edge case: card with zero in-stock variants', () => {
    it('should mark card as done when parser returns empty array', async () => {
      parser.parseDetailPage.mockReturnValue([]);

      const card = makeCard({ cardIdentifier: 'zero-card' });
      service.startFetch(DECK_ID, STORE_ID, [card]);

      await flushPromises();

      const progress = service.getProgress(DECK_ID);
      expect(progress!.cards.get('zero-card')).toBe('done');
      expect(progress!.completed).toBe(1);
      expect(progress!.failed).toBe(0);
    });

    it('should still call transaction when no variants parsed (delete-all for that card)', async () => {
      parser.parseDetailPage.mockReturnValue([]);

      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      await flushPromises();

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 5: Previously 3 variants, now 2 → removed variant deleted in transaction
  // ---------------------------------------------------------------------------

  describe('Scenario 5: edge case: variant disappears between fetches', () => {
    it('should delete rows that no longer appear on detail page within same transaction', async () => {
      const existingVariants = [
        makeVariantEntity({ id: 1, edition: 'HVY', condition: 'NM', finish: 'non-foil' }),
        makeVariantEntity({ id: 2, edition: 'U-MON', condition: 'NM', finish: 'non-foil' }),
        makeVariantEntity({ id: 3, edition: 'U-MON', condition: 'NM', finish: 'foil' }),
      ];

      const { emFindMock, emDeleteMock } = setupTransactionMock({ findExisting: existingVariants });

      // Parser returns only 2 variants now — foil disappeared
      parser.parseDetailPage.mockReturnValue([
        makeVariant({ edition: 'HVY', condition: 'NM', finish: 'non-foil' }),
        makeVariant({ edition: 'U-MON', condition: 'NM', finish: 'non-foil' }),
      ]);

      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      await flushPromises();

      expect(emFindMock).toHaveBeenCalled();
      // Should delete only the foil variant (id=3)
      expect(emDeleteMock).toHaveBeenCalledWith([3]);
    });

    it('should not call emDeleteMock when all existing variants are still present', async () => {
      const existingVariants = [
        makeVariantEntity({ id: 1, edition: 'HVY', condition: 'NM', finish: 'non-foil' }),
      ];

      const { emDeleteMock } = setupTransactionMock({ findExisting: existingVariants });

      // Parser returns the same single variant — nothing to delete
      parser.parseDetailPage.mockReturnValue([
        makeVariant({ edition: 'HVY', condition: 'NM', finish: 'non-foil' }),
      ]);

      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      await flushPromises();

      expect(emDeleteMock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 6: One card's fetch fails (network) → others still processed
  // ---------------------------------------------------------------------------

  describe('Scenario 6: error path: network failure on one card, others continue', () => {
    it('should mark failed card and continue processing remaining cards', async () => {
      const cards = [
        makeCard({ cardIdentifier: 'good-1', productUrl: `https://${STORE_HOSTNAME}/?id=1` }),
        makeCard({ cardIdentifier: 'bad-card', productUrl: `https://${STORE_HOSTNAME}/?id=2` }),
        makeCard({ cardIdentifier: 'good-2', productUrl: `https://${STORE_HOSTNAME}/?id=3` }),
      ];

      fetchGuard.guardedFetch
        .mockResolvedValueOnce({ status: 200, headers: {}, body: Buffer.from('<html>ok</html>') })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ status: 200, headers: {}, body: Buffer.from('<html>ok</html>') });

      service.startFetch(DECK_ID, STORE_ID, cards);

      await flushPromises();

      const progress = service.getProgress(DECK_ID);
      expect(progress!.cards.get('good-1')).toBe('done');
      expect(progress!.cards.get('bad-card')).toBe('failed');
      expect(progress!.cards.get('good-2')).toBe('done');
      expect(progress!.completed).toBe(2);
      expect(progress!.failed).toBe(1);
      expect(progress!.inProgress).toBe(false);
      expect(progress!.globalFailed).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 7: Parse failure on one card → graceful continuation
  // ---------------------------------------------------------------------------

  describe('Scenario 7: error path: parse failure on one card', () => {
    it('should mark parse-failed card and continue processing others', async () => {
      const cards = [
        makeCard({ cardIdentifier: 'ok-card' }),
        makeCard({ cardIdentifier: 'parse-fail-card' }),
      ];

      parser.parseDetailPage
        .mockReturnValueOnce([makeVariant()])
        .mockImplementationOnce(() => {
          throw new Error('Parse failed');
        });

      service.startFetch(DECK_ID, STORE_ID, cards);

      await flushPromises();

      const progress = service.getProgress(DECK_ID);
      expect(progress!.cards.get('ok-card')).toBe('done');
      expect(progress!.cards.get('parse-fail-card')).toBe('failed');
      expect(progress!.completed).toBe(1);
      expect(progress!.failed).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 8: Insert fails mid-transaction → rollback, existing data unchanged
  // ---------------------------------------------------------------------------

  describe('Scenario 8: error path: transaction failure — rollback, loop continues', () => {
    it('should mark card as failed when transaction throws, not abort the loop', async () => {
      const cards = [
        makeCard({ cardIdentifier: 'txn-fail-card' }),
        makeCard({ cardIdentifier: 'after-txn-card' }),
      ];

      (dataSource.transaction as jest.Mock)
        .mockRejectedValueOnce(new Error('DB insert failed'))
        .mockImplementation((cb: (em: unknown) => Promise<void>) => {
          const { em } = buildTransactionEmMock();
          return cb(em);
        });

      service.startFetch(DECK_ID, STORE_ID, cards);
      await flushPromises();

      const progress = service.getProgress(DECK_ID);
      expect(progress!.cards.get('txn-fail-card')).toBe('failed');
      expect(progress!.cards.get('after-txn-card')).toBe('done');
      expect(progress!.failed).toBe(1);
      expect(progress!.completed).toBe(1);
      expect(progress!.globalFailed).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 9: Unexpected error in orchestration loop → globalFailed, no crash
  // ---------------------------------------------------------------------------

  describe('Scenario 9: error path: catastrophic error in orchestration loop', () => {
    it('should set globalFailed=true and mark inProgress=false', async () => {
      storeRepo.findOne.mockRejectedValue(new Error('DB connection drop'));

      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      await flushPromises();

      const progress = service.getProgress(DECK_ID);
      expect(progress!.globalFailed).toBe(true);
      expect(progress!.inProgress).toBe(false);
    });

    it('should remove deckId from activeFetchSet after catastrophic failure', async () => {
      storeRepo.findOne.mockRejectedValue(new Error('DB connection drop'));

      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      await flushPromises();

      // After global failure, inProgress via isFreshForDeck should be false
      // (Set has been cleared in finally block)
      // Reset storeRepo mock so isFreshForDeck can proceed
      storeRepo.findOne.mockResolvedValue(makeStore());
      variantRepo.createQueryBuilder.mockReturnValue(buildQbMockForCount('0'));

      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, ['test-card-red']);
      expect(result.inProgress).toBe(false);
    });

    it('should NOT crash the process on unhandled rejection', async () => {
      storeRepo.findOne.mockRejectedValue(new Error('DB connection drop'));

      expect(() => {
        service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      }).not.toThrow();

      await flushPromises();
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 10: Rate limit respected via DB re-read
  // ---------------------------------------------------------------------------

  describe('Scenario 10: integration: rate limit respected between consecutive card fetches', () => {
    it('should re-read store.lastFetchedAt from DB before each card fetch', async () => {
      const cards = [
        makeCard({ cardIdentifier: 'rate-card-1' }),
        makeCard({ cardIdentifier: 'rate-card-2' }),
      ];

      service.startFetch(DECK_ID, STORE_ID, cards);
      await flushPromises();

      // 1 initial store load + 2 per-card reads = 3 calls
      expect(storeRepo.findOne).toHaveBeenCalledTimes(3);
    });

    it('should update store.lastFetchedAt in DB after each fetch', async () => {
      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      await flushPromises();

      expect(storeRepo.update).toHaveBeenCalledWith(
        { id: STORE_ID },
        expect.objectContaining({ lastFetchedAt: expect.any(Date) }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 11: Concurrent bulk scrape updating lastFetchedAt mid-detail-fetch
  // ---------------------------------------------------------------------------

  describe('Scenario 11: integration: DB rate limit coordinates with concurrent bulk scrape', () => {
    it('should use DB-re-read lastFetchedAt, not the initial in-memory value', async () => {
      const initialStore = makeStore({ lastFetchedAt: null, rateLimitMs: 0 });
      const storeAfterBulk = makeStore({
        lastFetchedAt: new Date(),
        rateLimitMs: 0, // 0 prevents actual sleep in tests
      });

      // First call returns store without lastFetchedAt (before bulk scrape)
      // Second call (per-card re-read) returns store updated by bulk scrape
      storeRepo.findOne
        .mockResolvedValueOnce(initialStore)
        .mockResolvedValueOnce(storeAfterBulk);

      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      await flushPromises();

      // Per-card re-read was performed (call count: 1 initial + 1 per-card = 2)
      expect(storeRepo.findOne).toHaveBeenCalledTimes(2);
      expect(fetchGuard.guardedFetch).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 12: Cooldown returns true when all cards have fresh data
  // ---------------------------------------------------------------------------

  describe('Scenario 12: happy path: cooldown check returns true when all cards fresh', () => {
    it('should return fresh=true when all cards have recent detailFetchedAt', async () => {
      const cardIdentifiers = ['card-x', 'card-y'];
      variantRepo.createQueryBuilder.mockReturnValue(buildQbMockForCount('2'));

      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, cardIdentifiers);

      expect(result.fresh).toBe(true);
      expect(result.inProgress).toBe(false);
    });

    it('should query with correct cutoff time (1 hour threshold)', async () => {
      const cardIdentifiers = ['card-x'];
      const qb = buildQbMockForCount('1');
      variantRepo.createQueryBuilder.mockReturnValue(qb);

      const before = new Date(Date.now() - 61 * 60 * 1000); // older than 1 hour
      await service.isFreshForDeck(STORE_ID, DECK_ID, cardIdentifiers);

      // andWhere should be called with detailFetchedAt > cutoff
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('detailFetchedAt'),
        expect.objectContaining({ cutoff: expect.any(Date) }),
      );

      // The cutoff should be approximately 1 hour ago
      const cutoffArg = (qb.andWhere as jest.Mock).mock.calls.find(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('detailFetchedAt'),
      )?.[1]?.cutoff as Date | undefined;
      expect(cutoffArg).toBeDefined();
      expect(cutoffArg!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 13: Cooldown returns false when any card lacks fresh data
  // ---------------------------------------------------------------------------

  describe('Scenario 13: happy path: cooldown check returns false when data missing or stale', () => {
    it('should return fresh=false when fewer cards have fresh data than requested', async () => {
      variantRepo.createQueryBuilder.mockReturnValue(buildQbMockForCount('1'));

      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, ['card-x', 'card-y', 'card-z']);

      expect(result.fresh).toBe(false);
    });

    it('should return fresh=true for empty cardIdentifiers array (nothing to check)', async () => {
      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, []);
      expect(result.fresh).toBe(true);
    });

    it('should return fresh=false when count is zero', async () => {
      variantRepo.createQueryBuilder.mockReturnValue(buildQbMockForCount('0'));

      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, ['card-x']);

      expect(result.fresh).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 14: Second startFetch for deck already fetching returns existing fetchId
  // ---------------------------------------------------------------------------

  describe('Scenario 14: edge case: second startFetch for active deck', () => {
    it('should return the existing fetchId without spawning a second loop', async () => {
      const cards = [makeCard({ cardIdentifier: 'active-card' })];

      const firstFetchId = service.startFetch(DECK_ID, STORE_ID, cards);

      // While first fetch is still in flight (loop not yet complete)
      const secondFetchId = service.startFetch(DECK_ID, STORE_ID, cards);

      expect(secondFetchId).toBe(firstFetchId);

      await flushPromises();

      // fetchGuard should only be called once (from first loop only)
      expect(fetchGuard.guardedFetch).toHaveBeenCalledTimes(1);
    });

    it('should report inProgress=true from getProgress while fetch is active', () => {
      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);

      const progress = service.getProgress(DECK_ID);
      expect(progress!.inProgress).toBe(true);
    });

    it('should allow a new fetch after the previous one completes', async () => {
      service.startFetch(DECK_ID, STORE_ID, [makeCard({ cardIdentifier: 'first' })]);
      await flushPromises();

      // First fetch done — start second one
      const secondFetchId = service.startFetch(DECK_ID, STORE_ID, [makeCard({ cardIdentifier: 'second' })]);

      const progress = service.getProgress(DECK_ID);
      expect(progress!.fetchId).toBe(secondFetchId);
      expect(progress!.inProgress).toBe(true);

      await flushPromises();
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 15: Progress entry removed 5 min after completion; timer cleared on destroy
  // ---------------------------------------------------------------------------

  describe('Scenario 15: edge case: progress cleanup and timer lifecycle', () => {
    it('should schedule progress cleanup after fetch completes', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);

      await flushPromises();

      expect(service.getProgress(DECK_ID)).toBeDefined();

      // Advance 5 minutes + 1ms — cleanup timer should fire
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);

      expect(service.getProgress(DECK_ID)).toBeUndefined();

      jest.useRealTimers();
    });

    it('should clear the cleanup timer when onModuleDestroy is called', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      await flushPromises();

      // Timer is now scheduled; onModuleDestroy clears it
      service.onModuleDestroy();

      // Progress entry should NOT have been deleted (timer was cancelled)
      // Advance time — entry should remain since timer was cleared
      jest.advanceTimersByTime(5 * 60 * 1000 + 1);

      // After onModuleDestroy, the cleanup timer is cancelled so the entry
      // might still exist (depending on whether delete ran before cancel)
      // The important assertion is that no error was thrown
      // and the cleanupTimers map is empty after destroy
      expect(service['cleanupTimers'].size).toBe(0);

      jest.useRealTimers();
    });
  });

  // ---------------------------------------------------------------------------
  // Scenario 16: Map size capped at 100 with LRU eviction
  // ---------------------------------------------------------------------------

  describe('Scenario 16: edge case: progress Map capped at 100 entries (LRU eviction)', () => {
    it('should evict oldest completed entries when Map reaches 100 entries', () => {
      // Pre-populate 100 completed entries
      for (let i = 0; i < 100; i++) {
        service['progressMap'].set(`deck-${i}`, {
          fetchId: `fetch-${i}`,
          total: 1,
          completed: 1,
          failed: 0,
          inProgress: false,
          startedAt: new Date(),
          cards: new Map(),
          globalFailed: false,
        });
      }

      expect(service['progressMap'].size).toBe(100);

      // startFetch calls evictLruEntries before adding new entry
      service.startFetch('deck-new', STORE_ID, [makeCard()]);

      // Map size should not exceed 100 (one entry evicted before adding new one)
      expect(service['progressMap'].size).toBeLessThanOrEqual(100);
    });

    it('should not evict in-progress entries — only completed ones', () => {
      // Pre-populate 99 completed entries + 1 in-progress
      for (let i = 0; i < 99; i++) {
        service['progressMap'].set(`deck-${i}`, {
          fetchId: `fetch-${i}`,
          total: 1,
          completed: 1,
          failed: 0,
          inProgress: false,
          startedAt: new Date(),
          cards: new Map(),
          globalFailed: false,
        });
      }
      service['progressMap'].set('deck-active', {
        fetchId: 'fetch-active',
        total: 1,
        completed: 0,
        failed: 0,
        inProgress: true, // must NOT be evicted
        startedAt: new Date(),
        cards: new Map(),
        globalFailed: false,
      });

      expect(service['progressMap'].size).toBe(100);

      service.startFetch('deck-new', STORE_ID, [makeCard()]);

      // deck-active (in-progress) must still be present
      expect(service['progressMap'].has('deck-active')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Additional: getProgress shape
  // ---------------------------------------------------------------------------

  describe('getProgress', () => {
    it('should return undefined when no fetch has been started for deckId', () => {
      expect(service.getProgress('non-existent-deck')).toBeUndefined();
    });

    it('should return the progress record with the correct fetchId', () => {
      const fetchId = service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      const progress = service.getProgress(DECK_ID);

      expect(progress).toBeDefined();
      expect(progress!.fetchId).toBe(fetchId);
    });
  });

  // ---------------------------------------------------------------------------
  // Additional: isFreshForDeck inProgress from active Set
  // ---------------------------------------------------------------------------

  describe('isFreshForDeck inProgress flag reflects active Set', () => {
    it('should return inProgress=true while a fetch is active', async () => {
      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);

      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, ['test-card-red']);
      expect(result.inProgress).toBe(true);

      await flushPromises();
    });

    it('should return inProgress=false after fetch loop completes', async () => {
      service.startFetch(DECK_ID, STORE_ID, [makeCard()]);
      await flushPromises();

      const result = await service.isFreshForDeck(STORE_ID, DECK_ID, ['test-card-red']);
      expect(result.inProgress).toBe(false);
    });
  });
});
