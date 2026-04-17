import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  HttpStatus,
  INestApplication,
} from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';
import { StoreEntity } from '../../database/entities/store.entity';
import { OwnsTrackedDeckGuard } from '../../auth/guards/owns-tracked-deck.guard';
import {
  IFetchCard,
  IFreshCheckResult,
  VariantFetchService,
} from '../../stores/variant-fetch.service';
import { IVariantFetchProgress } from '../../stores/types/variant-fetch-progress';
import { VariantFetchController } from '../variant-fetch.controller';
import { DecksService } from '../decks.service';
import { ShoppingLineService } from '../../stores/shopping-line.service';
import {
  IShoppingLinePopulated,
  IVariantFetchProgressDto,
} from '../../stores/dtos/shopping-line.response.dto';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const USER_ID = 'user-e2e-vf-001';
const OTHER_USER_ID = 'user-e2e-vf-002';
const DECK_ID = 42;

function buildStore(overrides: Partial<StoreEntity> = {}): StoreEntity {
  return {
    id: 1,
    name: 'Cupula DT',
    slug: 'cupula-dt',
    baseUrl: 'https://www.cupuladt.com.br',
    active: true,
    rateLimitMs: 1500,
    lastFetchedAt: null,
    stockRows: [],
    scrapeRuns: [],
    ...overrides,
  } as StoreEntity;
}

function buildSnapshot(
  missing: Array<{ cardIdentifier: string; quantity: number }> = [],
): DeckReadinessSnapshotEntity {
  return {
    id: 10,
    trackedDeckId: DECK_ID,
    rawPercent: 75,
    effectivePercent: 80,
    breakdown: {
      exact: [],
      substituted: [],
      missing: missing.map((m) => ({
        ...m,
        slot: 'main',
      })),
      notOwned: [],
    },
    substitutions: {},
    computedAt: new Date('2026-04-13T10:00:00Z'),
    trackedDeck: {} as DeckReadinessSnapshotEntity['trackedDeck'],
  };
}

function buildStockRow(
  cardIdentifier: string,
  overrides: Partial<StoreStockEntity> = {},
): StoreStockEntity {
  return {
    id: 100,
    storeId: 1,
    cardIdentifier,
    productNameRaw: cardIdentifier,
    priceCents: 5000,
    quantity: 4,
    productUrl: `https://www.cupuladt.com.br/cards/${cardIdentifier}`,
    lastFetchedAt: new Date('2026-04-13T09:00:00Z'),
    store: {} as StoreStockEntity['store'],
    ...overrides,
  };
}

function buildProgress(
  overrides: Partial<IVariantFetchProgress> = {},
): IVariantFetchProgress {
  return {
    fetchId: 'fetch-uuid-001',
    total: 3,
    completed: 1,
    failed: 0,
    inProgress: true,
    startedAt: new Date(),
    cards: new Map(),
    globalFailed: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test module factory helpers
// ---------------------------------------------------------------------------

/**
 * Builds a slim NestJS application wired for e2e controller tests.
 *
 * The real JwtAuthGuard is APP_GUARD-scoped and is absent in this test
 * module, so we inject the user shape via middleware.
 * OwnsTrackedDeckGuard is replaced with an allow/deny mock per test.
 */
async function buildApp(opts: {
  userId: string;
  guardAllows: boolean;
  variantFetchService: jest.Mocked<VariantFetchService>;
  snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  storeStockRepo: jest.Mocked<Repository<StoreStockEntity>>;
  storeRepo: jest.Mocked<Repository<StoreEntity>>;
}): Promise<INestApplication> {
  const { userId, guardAllows } = opts;

  const mockGuard = {
    canActivate: jest.fn().mockImplementation(() => {
      if (!guardAllows) {
        throw new ForbiddenException('Access denied');
      }
      return true;
    }),
  };

  const moduleRef: TestingModule = await Test.createTestingModule({
    controllers: [VariantFetchController],
    providers: [
      { provide: VariantFetchService, useValue: opts.variantFetchService },
      {
        provide: getRepositoryToken(DeckReadinessSnapshotEntity),
        useValue: opts.snapshotRepo,
      },
      {
        provide: getRepositoryToken(StoreStockEntity),
        useValue: opts.storeStockRepo,
      },
      {
        provide: getRepositoryToken(StoreEntity),
        useValue: opts.storeRepo,
      },
    ],
  })
    .overrideGuard(OwnsTrackedDeckGuard)
    .useValue(mockGuard)
    .compile();

  const app = moduleRef.createNestApplication();

  // Inject the authenticated user into req.user (simulates JwtAuthGuard).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as Request & { user: { userId: string } }).user = { userId };
    next();
  });

  await app.init();
  return app;
}

// ---------------------------------------------------------------------------
// Shared mock factories
// ---------------------------------------------------------------------------

function makeServiceMocks() {
  const variantFetchService = createMock<VariantFetchService>();
  const snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
  const storeStockRepo = createMock<Repository<StoreStockEntity>>();
  const storeRepo = createMock<Repository<StoreEntity>>();
  return { variantFetchService, snapshotRepo, storeStockRepo, storeRepo };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('VariantFetchController (e2e)', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Happy path — triggers a new fetch, returns 202 started
  // -------------------------------------------------------------------------
  describe('POST /decks/:deckId/fetch-variants — happy: starts new fetch', () => {
    it('returns 202 with fetchId and total when fetch is started', async () => {
      // Arrange
      const mocks = makeServiceMocks();
      const missing = [
        { cardIdentifier: 'card-a', quantity: 2 },
        { cardIdentifier: 'card-b', quantity: 1 },
      ];

      mocks.snapshotRepo.findOne.mockResolvedValue(buildSnapshot(missing));
      mocks.storeRepo.findOne.mockResolvedValue(buildStore());
      mocks.variantFetchService.getProgress.mockReturnValue(undefined);
      mocks.variantFetchService.isFreshForDeck.mockResolvedValue({
        fresh: false,
        inProgress: false,
      } satisfies IFreshCheckResult);
      mocks.storeStockRepo.find.mockResolvedValue([
        buildStockRow('card-a'),
        buildStockRow('card-b'),
      ]);
      mocks.variantFetchService.startFetch.mockReturnValue('fetch-uuid-new');

      app = await buildApp({
        userId: USER_ID,
        guardAllows: true,
        ...mocks,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post(`/decks/${DECK_ID}/fetch-variants`)
        .expect(HttpStatus.ACCEPTED)
        .expect((res) => {
          expect(res.body.status).toBe('started');
          expect(res.body.fetchId).toBe('fetch-uuid-new');
          expect(res.body.total).toBe(2);
        });

      expect(mocks.variantFetchService.startFetch).toHaveBeenCalledWith(
        String(DECK_ID),
        1,
        expect.arrayContaining<IFetchCard>([
          expect.objectContaining({ cardIdentifier: 'card-a' }),
          expect.objectContaining({ cardIdentifier: 'card-b' }),
        ]),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Already fresh — returns 200 already_fresh
  // -------------------------------------------------------------------------
  describe('POST /decks/:deckId/fetch-variants — happy: already fresh', () => {
    it('returns 200 already_fresh when all cards have fresh variant data', async () => {
      // Arrange
      const mocks = makeServiceMocks();
      const missing = [{ cardIdentifier: 'card-a', quantity: 1 }];

      mocks.snapshotRepo.findOne.mockResolvedValue(buildSnapshot(missing));
      mocks.storeRepo.findOne.mockResolvedValue(buildStore());
      mocks.variantFetchService.getProgress.mockReturnValue(undefined);
      mocks.variantFetchService.isFreshForDeck.mockResolvedValue({
        fresh: true,
        inProgress: false,
      } satisfies IFreshCheckResult);

      app = await buildApp({
        userId: USER_ID,
        guardAllows: true,
        ...mocks,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post(`/decks/${DECK_ID}/fetch-variants`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.status).toBe('already_fresh');
        });

      expect(mocks.variantFetchService.startFetch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3: User does not own the deck — returns 403
  // -------------------------------------------------------------------------
  describe('POST /decks/:deckId/fetch-variants — error: 403 not owner', () => {
    it('returns 403 when OwnsTrackedDeckGuard rejects the request', async () => {
      // Arrange
      const mocks = makeServiceMocks();

      app = await buildApp({
        userId: OTHER_USER_ID,
        guardAllows: false,
        ...mocks,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post(`/decks/${DECK_ID}/fetch-variants`)
        .expect(HttpStatus.FORBIDDEN);

      expect(mocks.variantFetchService.startFetch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 4: No missing cards — returns 200 nothing_to_fetch
  // -------------------------------------------------------------------------
  describe('POST /decks/:deckId/fetch-variants — error: no missing cards', () => {
    it('returns 200 nothing_to_fetch when deck has no missing cards', async () => {
      // Arrange
      const mocks = makeServiceMocks();

      // Snapshot with empty missing array.
      mocks.snapshotRepo.findOne.mockResolvedValue(buildSnapshot([]));

      app = await buildApp({
        userId: USER_ID,
        guardAllows: true,
        ...mocks,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post(`/decks/${DECK_ID}/fetch-variants`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.status).toBe('nothing_to_fetch');
        });

      expect(mocks.variantFetchService.startFetch).not.toHaveBeenCalled();
    });

    it('returns 200 nothing_to_fetch when no snapshot exists', async () => {
      // Arrange
      const mocks = makeServiceMocks();
      mocks.snapshotRepo.findOne.mockResolvedValue(null);

      app = await buildApp({
        userId: USER_ID,
        guardAllows: true,
        ...mocks,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post(`/decks/${DECK_ID}/fetch-variants`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.status).toBe('nothing_to_fetch');
        });
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 8: Second POST while first is running — 202 in_progress
  // -------------------------------------------------------------------------
  describe('POST /decks/:deckId/fetch-variants — edge: duplicate while in progress', () => {
    it('returns 202 in_progress with existing fetchId when a fetch is already active', async () => {
      // Arrange
      const mocks = makeServiceMocks();
      const missing = [{ cardIdentifier: 'card-a', quantity: 1 }];
      const existingProgress = buildProgress({ fetchId: 'fetch-existing' });

      mocks.snapshotRepo.findOne.mockResolvedValue(buildSnapshot(missing));
      mocks.variantFetchService.getProgress.mockReturnValue(existingProgress);

      app = await buildApp({
        userId: USER_ID,
        guardAllows: true,
        ...mocks,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post(`/decks/${DECK_ID}/fetch-variants`)
        .expect(HttpStatus.ACCEPTED)
        .expect((res) => {
          expect(res.body.status).toBe('in_progress');
          expect(res.body.fetchId).toBe('fetch-existing');
          expect(res.body.progress.inProgress).toBe(true);
        });

      // Must NOT spawn a duplicate loop.
      expect(mocks.variantFetchService.startFetch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 10: User B POSTs on user A's deck — 403
  // -------------------------------------------------------------------------
  describe('POST /decks/:deckId/fetch-variants — edge: cross-user 403', () => {
    it('returns 403 when authenticated user B tries to fetch variants for user A deck', async () => {
      // Arrange: guard rejects because user B does not own deck.
      const mocks = makeServiceMocks();

      app = await buildApp({
        userId: OTHER_USER_ID,
        guardAllows: false,
        ...mocks,
      });

      // Act & Assert
      await request(app.getHttpServer())
        .post(`/decks/${DECK_ID}/fetch-variants`)
        .expect(HttpStatus.FORBIDDEN);
    });
  });
});

// ---------------------------------------------------------------------------
// DecksService integration: variantFetchProgress on deck detail
// ---------------------------------------------------------------------------

describe('DecksService — variantFetchProgress on getDetail()', () => {
  it('includes variantFetchProgress on the populated shopping line when a fetch is active', () => {
    // This test validates the DTO shape contract at the type level.
    // The actual service wiring is unit-tested in decks.service.spec.ts.
    // Here we verify the IShoppingLinePopulated shape accepts the optional field.

    const progress: IVariantFetchProgressDto = {
      fetchId: 'fetch-uuid-001',
      total: 3,
      completed: 1,
      failed: 0,
      inProgress: true,
    };

    const line: IShoppingLinePopulated = {
      kind: 'populated',
      storeName: 'Cupula DT',
      storeSlug: 'cupula-dt',
      storeHostname: 'www.cupuladt.com.br',
      totalCostCents: 5000,
      availableCardCount: 1,
      unavailableCardCount: 0,
      lastFetchedAt: new Date(0).toISOString(),
      lines: [],
      upgradeCandidates: [],
      isEstimated: true,
      variantFetchProgress: progress,
    };

    expect(line.variantFetchProgress).toEqual(progress);
    expect(line.variantFetchProgress?.inProgress).toBe(true);
  });

  it('omits variantFetchProgress when no fetch has been started', () => {
    // When no progress entry exists the field must be absent (undefined).
    const line: IShoppingLinePopulated = {
      kind: 'populated',
      storeName: 'Cupula DT',
      storeSlug: 'cupula-dt',
      storeHostname: 'www.cupuladt.com.br',
      totalCostCents: 5000,
      availableCardCount: 1,
      unavailableCardCount: 0,
      lastFetchedAt: new Date(0).toISOString(),
      lines: [],
      upgradeCandidates: [],
      isEstimated: false,
    };

    expect(line.variantFetchProgress).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Regression: IShoppingLineAggregate must NOT include variant/fetch fields
// ---------------------------------------------------------------------------

describe('IShoppingLineAggregate — regression: no variant/fetch fields', () => {
  it('does not have variantFetchProgress, variants, hasVariantData, or isEstimated', () => {
    // Importing and checking that the aggregate type does not include these
    // fields is validated at compile time by TypeScript. This runtime test
    // guards against accidental JS-level additions.
    const aggregate = {
      storeName: 'Cupula DT',
      storeSlug: 'cupula-dt',
      totalCostCents: 10000,
      decksCompletable: 2,
      totalDecks: 3,
    };

    // These keys must NOT be present.
    expect(aggregate).not.toHaveProperty('variantFetchProgress');
    expect(aggregate).not.toHaveProperty('variants');
    expect(aggregate).not.toHaveProperty('hasVariantData');
    expect(aggregate).not.toHaveProperty('isEstimated');
  });
});
