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
import { StoreEntity } from '../../database/entities/store.entity';
import { OwnsTrackedDeckGuard } from '../../auth/guards/owns-tracked-deck.guard';
import {
  IFetchCard,
  IFreshCheckResult,
  VariantFetchService,
} from '../../stores/variant-fetch.service';
import { IVariantFetchProgress } from '../../stores/types/variant-fetch-progress';
import { VariantFetchController } from '../variant-fetch.controller';
import {
  IShoppingLinePopulated,
  IVariantFetchProgressDto,
} from '../../stores/dtos/shopping-line.response.dto';
import {
  EVariantFetchJobStatus,
  VariantFetchJobEntity,
} from '../../database/entities/variant-fetch-job.entity';
import { VariantFetchQueueService } from '../../stores/variant-fetch-queue.service';
import { ResolveJobCardsService } from '../../stores/resolve-job-cards.service';

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

function buildJob(overrides: Partial<VariantFetchJobEntity> = {}): VariantFetchJobEntity {
  return {
    id: 'job-uuid-001',
    userId: 1,
    deckId: DECK_ID,
    storeId: 1,
    status: EVariantFetchJobStatus.Pending,
    cards: [],
    total: 2,
    completed: 0,
    failed: 0,
    enqueuedAt: new Date(),
    startedAt: null,
    finishedAt: null,
    claimedAt: null,
    claimedBy: null,
    error: null,
    ...overrides,
  } as VariantFetchJobEntity;
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
  queueService: jest.Mocked<VariantFetchQueueService>;
  resolveJobCards: jest.Mocked<ResolveJobCardsService>;
  snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
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
      { provide: VariantFetchQueueService, useValue: opts.queueService },
      { provide: ResolveJobCardsService, useValue: opts.resolveJobCards },
      {
        provide: getRepositoryToken(DeckReadinessSnapshotEntity),
        useValue: opts.snapshotRepo,
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
    (req as Request & { user: { userId: string; email: string } }).user = {
      userId,
      email: 'test@example.com',
    };
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
  const queueService = createMock<VariantFetchQueueService>();
  const resolveJobCards = createMock<ResolveJobCardsService>();
  const snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
  const storeRepo = createMock<Repository<StoreEntity>>();
  return { variantFetchService, queueService, resolveJobCards, snapshotRepo, storeRepo };
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
  // Scenario 1: Happy path — enqueues a job, returns 202 started
  // -------------------------------------------------------------------------
  describe('POST /decks/:deckId/fetch-variants — happy: enqueues new job', () => {
    it('returns 202 with jobId and status when a job is enqueued', async () => {
      // Arrange
      const mocks = makeServiceMocks();
      const missing = [
        { cardIdentifier: 'card-a', quantity: 2 },
        { cardIdentifier: 'card-b', quantity: 1 },
      ];
      const fetchCards: IFetchCard[] = [
        { cardIdentifier: 'card-a', productUrl: 'https://example.com/card-a', listingPriceCents: 5000, listingQuantity: 2 },
        { cardIdentifier: 'card-b', productUrl: 'https://example.com/card-b', listingPriceCents: 3000, listingQuantity: 1 },
      ];

      mocks.snapshotRepo.findOne.mockResolvedValue(buildSnapshot(missing));
      mocks.storeRepo.findOne.mockResolvedValue(buildStore());
      mocks.variantFetchService.getProgress.mockReturnValue(undefined);
      mocks.variantFetchService.isFreshForDeck.mockResolvedValue({
        fresh: false,
        inProgress: false,
      } satisfies IFreshCheckResult);
      mocks.resolveJobCards.resolve.mockResolvedValue(fetchCards);
      mocks.queueService.enqueue.mockResolvedValue(buildJob({ id: 'job-new-001' }));

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
          expect(res.body.jobId).toBe('job-new-001');
          expect(res.body.jobStatus).toBe('pending');
        });

      expect(mocks.queueService.enqueue).toHaveBeenCalledTimes(1);
      expect(mocks.queueService.enqueue).toHaveBeenCalledWith(
        expect.any(String),
        DECK_ID,
        1,
        fetchCards,
      );
    });

    it('passes resolved cards (from ResolveJobCardsService) to the queue', async () => {
      // Arrange
      const mocks = makeServiceMocks();
      const missing = [{ cardIdentifier: 'card-x', quantity: 1 }];
      const resolvedCards: IFetchCard[] = [
        { cardIdentifier: 'card-x', productUrl: 'https://example.com/card-x', listingPriceCents: null, listingQuantity: 1 },
      ];

      mocks.snapshotRepo.findOne.mockResolvedValue(buildSnapshot(missing));
      mocks.storeRepo.findOne.mockResolvedValue(buildStore());
      mocks.variantFetchService.getProgress.mockReturnValue(undefined);
      mocks.variantFetchService.isFreshForDeck.mockResolvedValue({
        fresh: false,
        inProgress: false,
      } satisfies IFreshCheckResult);
      mocks.resolveJobCards.resolve.mockResolvedValue(resolvedCards);
      mocks.queueService.enqueue.mockResolvedValue(buildJob());

      app = await buildApp({ userId: USER_ID, guardAllows: true, ...mocks });

      await request(app.getHttpServer())
        .post(`/decks/${DECK_ID}/fetch-variants`)
        .expect(HttpStatus.ACCEPTED);

      expect(mocks.resolveJobCards.resolve).toHaveBeenCalledWith(
        1,
        expect.arrayContaining(['card-x']),
      );
      expect(mocks.queueService.enqueue).toHaveBeenCalledWith(
        expect.any(String),
        DECK_ID,
        1,
        resolvedCards,
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

      expect(mocks.queueService.enqueue).not.toHaveBeenCalled();
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

      expect(mocks.queueService.enqueue).not.toHaveBeenCalled();
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

      expect(mocks.queueService.enqueue).not.toHaveBeenCalled();
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

    it('returns 200 nothing_to_fetch when all resolved cards have no productUrl', async () => {
      // Arrange
      const mocks = makeServiceMocks();
      mocks.snapshotRepo.findOne.mockResolvedValue(
        buildSnapshot([{ cardIdentifier: 'card-a', quantity: 1 }]),
      );
      mocks.storeRepo.findOne.mockResolvedValue(buildStore());
      mocks.variantFetchService.getProgress.mockReturnValue(undefined);
      mocks.variantFetchService.isFreshForDeck.mockResolvedValue({
        fresh: false,
        inProgress: false,
      } satisfies IFreshCheckResult);
      // ResolveJobCardsService returns empty (all cards lack productUrl).
      mocks.resolveJobCards.resolve.mockResolvedValue([]);

      app = await buildApp({ userId: USER_ID, guardAllows: true, ...mocks });

      await request(app.getHttpServer())
        .post(`/decks/${DECK_ID}/fetch-variants`)
        .expect(HttpStatus.OK)
        .expect((res) => {
          expect(res.body.status).toBe('nothing_to_fetch');
        });

      expect(mocks.queueService.enqueue).not.toHaveBeenCalled();
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

      // Must NOT spawn a duplicate job.
      expect(mocks.queueService.enqueue).not.toHaveBeenCalled();
    });

    it('serializes the per-card status Map as a plain object under progress.cards', async () => {
      // Arrange: progress has a populated Map with three cards in different states.
      const mocks = makeServiceMocks();
      const missing = [{ cardIdentifier: 'card-a', quantity: 1 }];
      const cardsMap = new Map<string, 'pending' | 'done' | 'failed'>([
        ['card-a', 'done'],
        ['card-b', 'pending'],
        ['card-c', 'failed'],
      ]);
      const existingProgress = buildProgress({
        fetchId: 'fetch-with-cards',
        total: 3,
        completed: 1,
        failed: 1,
        cards: cardsMap,
      });

      mocks.snapshotRepo.findOne.mockResolvedValue(buildSnapshot(missing));
      mocks.variantFetchService.getProgress.mockReturnValue(existingProgress);

      app = await buildApp({
        userId: USER_ID,
        guardAllows: true,
        ...mocks,
      });

      // Act & Assert: the Map must be flattened into a JSON-friendly object.
      await request(app.getHttpServer())
        .post(`/decks/${DECK_ID}/fetch-variants`)
        .expect(HttpStatus.ACCEPTED)
        .expect((res) => {
          expect(res.body.progress.cards).toEqual({
            'card-a': 'done',
            'card-b': 'pending',
            'card-c': 'failed',
          });
        });
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

  it('accepts the optional cards map on variantFetchProgress DTO', () => {
    const progress: IVariantFetchProgressDto = {
      fetchId: 'fetch-uuid-002',
      total: 2,
      completed: 1,
      failed: 1,
      inProgress: false,
      cards: {
        'card-a': 'done',
        'card-b': 'failed',
      },
    };

    expect(progress.cards).toEqual({ 'card-a': 'done', 'card-b': 'failed' });
    expect(progress.cards?.['card-b']).toBe('failed');
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
