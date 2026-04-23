import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { CollectionReadService } from '../../collection/collection-read.service';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../auth/authz.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { ShoppingLineService } from '../../stores/shopping-line.service';
import { VariantFetchService } from '../../stores/variant-fetch.service';
import { DecisionsService } from '../decisions/decisions.service';
import { DecksService } from '../decks.service';

const USER_ID = 'user-uuid-123';
const OTHER_USER_ID = 'user-uuid-456';

function buildTrackedDeck(
  overrides: Partial<TrackedDeckEntity> = {},
): TrackedDeckEntity {
  return {
    id: 1,
    userId: USER_ID,
    fabraryUlid: '01H0000000000000000000AAAA',
    name: 'Bravo Showstopper',
    hero: 'Bravo',
    format: 'Classic Constructed',
    trackedAt: new Date('2025-01-15T10:00:00Z'),
    user: {} as TrackedDeckEntity['user'],
    ...overrides,
  };
}

function buildSnapshot(
  overrides: Partial<DeckReadinessSnapshotEntity> = {},
): DeckReadinessSnapshotEntity {
  return {
    id: 10,
    trackedDeckId: 1,
    rawPercent: 75.5,
    effectivePercent: 82.3,
    breakdown: {},
    substitutions: {},
    computedAt: new Date('2025-01-15T10:05:00Z'),
    trackedDeck: {} as DeckReadinessSnapshotEntity['trackedDeck'],
    ...overrides,
  };
}

describe('DecksService', () => {
  let service: DecksService;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let collectionReadService: jest.Mocked<CollectionReadService>;
  let authzService: jest.Mocked<AuthzService>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let shoppingLineService: jest.Mocked<ShoppingLineService>;
  let variantFetchService: jest.Mocked<VariantFetchService>;
  let decisionsService: jest.Mocked<DecisionsService>;

  beforeEach(async () => {
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    collectionReadService = createMock<CollectionReadService>();
    authzService = createMock<AuthzService>();
    substitutionService = createMock<SubstitutionService>();
    shoppingLineService = createMock<ShoppingLineService>();
    variantFetchService = createMock<VariantFetchService>();
    decisionsService = createMock<DecisionsService>();

    // Default: shopping line returns null (Path A / no missing cards).
    shoppingLineService.computeForBreakdown.mockResolvedValue(null);

    // Default: aggregate shopping line returns null (no tracked decks / all Path A).
    shoppingLineService.computeAggregate.mockResolvedValue(null);

    // Default: no in-progress variant fetch.
    variantFetchService.getProgress.mockReturnValue(undefined);

    // Default: no collection cards owned. Individual tests override as needed.
    collectionReadService.countUniqueOwned.mockResolvedValue(0);

    // Default: no decisions — rejectedCount=0, empty list.
    decisionsService.countRejected.mockResolvedValue(0);
    decisionsService.list.mockResolvedValue([]);
    decisionsService.loadExclusions.mockResolvedValue(new Set());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksService,
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
        {
          provide: getRepositoryToken(DeckCardEntity),
          useValue: deckCardRepo,
        },
        {
          provide: getRepositoryToken(DeckReadinessSnapshotEntity),
          useValue: snapshotRepo,
        },
        { provide: CollectionReadService, useValue: collectionReadService },
        { provide: AuthzService, useValue: authzService },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: ShoppingLineService, useValue: shoppingLineService },
        { provide: VariantFetchService, useValue: variantFetchService },
        { provide: DecisionsService, useValue: decisionsService },
      ],
    }).compile();

    service = module.get<DecksService>(DecksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listForUser', () => {
    it('should return empty trackedDecks and zero collectionCardCount when user has nothing', async () => {
      // Arrange
      trackedDeckRepo.find.mockResolvedValue([]);
      collectionReadService.countUniqueOwned.mockResolvedValue(0);
      shoppingLineService.computeAggregate.mockResolvedValue(null);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(result).toEqual({
        trackedDecks: [],
        collectionCardCount: 0,
        aggregateShoppingLine: null,
      });
      expect(trackedDeckRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        order: { trackedAt: 'DESC' },
      });
    });

    it('should return collectionCardCount when user has cards but no tracked decks', async () => {
      // Arrange
      trackedDeckRepo.find.mockResolvedValue([]);
      collectionReadService.countUniqueOwned.mockResolvedValue(42);
      shoppingLineService.computeAggregate.mockResolvedValue(null);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(result.trackedDecks).toEqual([]);
      expect(result.collectionCardCount).toBe(42);
      expect(result.aggregateShoppingLine).toBeNull();
    });

    it('should scope collectionCardCount query to the authenticated userId only', async () => {
      // Arrange: cross-user isolation regression. The count query must filter by
      // userId so one user never sees another user's collection size.
      trackedDeckRepo.find.mockResolvedValue([]);
      collectionReadService.countUniqueOwned.mockResolvedValue(7);
      shoppingLineService.computeAggregate.mockResolvedValue(null);

      // Act
      await service.listForUser(USER_ID);

      // Assert
      expect(collectionReadService.countUniqueOwned).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(collectionReadService.countUniqueOwned).toHaveBeenCalledTimes(1);
    });

    it('should return tracked decks with their latest snapshot and collectionCardCount', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      const snapshot = buildSnapshot();
      trackedDeckRepo.find.mockResolvedValue([deck]);
      collectionReadService.countUniqueOwned.mockResolvedValue(15);

      const qb = createMock<SelectQueryBuilder<DeckReadinessSnapshotEntity>>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getMany.mockResolvedValue([snapshot]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(result.collectionCardCount).toBe(15);
      expect(result.trackedDecks).toHaveLength(1);
      expect(result.trackedDecks[0]).toEqual({
        id: deck.id,
        fabraryUlid: deck.fabraryUlid,
        name: deck.name,
        hero: deck.hero,
        format: deck.format,
        trackedAt: deck.trackedAt.toISOString(),
        latestSnapshot: {
          rawPercent: snapshot.rawPercent,
          effectivePercent: snapshot.effectivePercent,
          computedAt: snapshot.computedAt.toISOString(),
        },
      });
      // Default mock returns null — aggregateShoppingLine is null when no missing cards.
      expect(result.aggregateShoppingLine).toBeNull();
    });

    it('(U10) should call computeAggregate and attach aggregateShoppingLine to response', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      const snapshot = buildSnapshot();
      trackedDeckRepo.find.mockResolvedValue([deck]);
      collectionReadService.countUniqueOwned.mockResolvedValue(5);

      const qb = createMock<SelectQueryBuilder<DeckReadinessSnapshotEntity>>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getMany.mockResolvedValue([snapshot]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      const aggregate = {
        storeName: 'Cúpula DT',
        storeSlug: 'cupula-dt',
        totalCostCents: 31200,
        completableDecks: 3,
        totalDecks: 5,
        kind: 'populated' as const,
        uniqueCardsMissing: 12,
      };
      shoppingLineService.computeAggregate.mockResolvedValue(aggregate);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(shoppingLineService.computeAggregate).toHaveBeenCalledWith(USER_ID);
      expect(result.aggregateShoppingLine).toEqual(aggregate);
    });

    it('(U10) computeAggregate called in parallel — response includes null aggregate when no stock', async () => {
      // Arrange: decks exist but aggregate returns null (no missing cards / all Path A).
      const deck = buildTrackedDeck();
      const snapshot = buildSnapshot();
      trackedDeckRepo.find.mockResolvedValue([deck]);
      collectionReadService.countUniqueOwned.mockResolvedValue(0);

      const qb = createMock<SelectQueryBuilder<DeckReadinessSnapshotEntity>>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getMany.mockResolvedValue([snapshot]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      shoppingLineService.computeAggregate.mockResolvedValue(null);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert: aggregate is null, trackedDecks still populated.
      expect(result.aggregateShoppingLine).toBeNull();
      expect(result.trackedDecks).toHaveLength(1);
    });

    it('should auto-recompute when no snapshot exists for a deck', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      const recomputedSnapshot = buildSnapshot({
        id: 20,
        rawPercent: 0,
        effectivePercent: 0,
      });
      trackedDeckRepo.find.mockResolvedValue([deck]);
      collectionReadService.countUniqueOwned.mockResolvedValue(3);

      const qb = createMock<SelectQueryBuilder<DeckReadinessSnapshotEntity>>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getMany.mockResolvedValue([]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      substitutionService.computeAndStoreReadiness.mockResolvedValue(
        recomputedSnapshot,
      );

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(result.trackedDecks).toHaveLength(1);
      expect(result.trackedDecks[0]!.latestSnapshot).toEqual({
        rawPercent: 0,
        effectivePercent: 0,
        computedAt: recomputedSnapshot.computedAt.toISOString(),
      });
      // U9 bug fix: exclusions must be loaded and passed to computeAndStoreReadiness.
      expect(decisionsService.loadExclusions).toHaveBeenCalledWith(deck.id);
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(
        deck.id,
        USER_ID,
        expect.any(Set),
      );
      expect(result.collectionCardCount).toBe(3);
    });

    it('(regression: listForUser bug fix) auto-recompute passes exclusion set so rejected decisions lower readiness', async () => {
      // Arrange: seed a rejected decision — exclusion set must be non-empty.
      const deck = buildTrackedDeck();
      const recomputedSnapshot = buildSnapshot({
        id: 30,
        rawPercent: 60,
        effectivePercent: 60,
      });
      trackedDeckRepo.find.mockResolvedValue([deck]);
      collectionReadService.countUniqueOwned.mockResolvedValue(0);

      const qb = createMock<SelectQueryBuilder<DeckReadinessSnapshotEntity>>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getMany.mockResolvedValue([]); // Force auto-recompute.
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      // Simulate a rejected decision exists.
      decisionsService.loadExclusions.mockResolvedValue(new Set(['rejected-card-x']));
      substitutionService.computeAndStoreReadiness.mockResolvedValue(recomputedSnapshot);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert: the exclusion set passed to computeAndStoreReadiness contains the
      // rejected card identifier — the bug fix is exercised.
      const exclusionsArg = (
        substitutionService.computeAndStoreReadiness as jest.Mock
      ).mock.calls[0][2] as Set<string>;
      expect(exclusionsArg.has('rejected-card-x')).toBe(true);
      expect(result.trackedDecks[0]!.latestSnapshot?.effectivePercent).toBe(60);
    });

    it('should return multiple decks ordered by trackedAt DESC', async () => {
      // Arrange
      const deck1 = buildTrackedDeck({ id: 1, name: 'Deck A' });
      const deck2 = buildTrackedDeck({
        id: 2,
        name: 'Deck B',
        fabraryUlid: '01H0000000000000000000BBBB',
        trackedAt: new Date('2025-01-16T10:00:00Z'),
      });
      trackedDeckRepo.find.mockResolvedValue([deck2, deck1]);
      collectionReadService.countUniqueOwned.mockResolvedValue(100);

      const snap1 = buildSnapshot({ id: 10, trackedDeckId: 1 });
      const snap2 = buildSnapshot({
        id: 11,
        trackedDeckId: 2,
        rawPercent: 90,
        effectivePercent: 95,
      });

      const qb = createMock<SelectQueryBuilder<DeckReadinessSnapshotEntity>>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getMany.mockResolvedValue([snap1, snap2]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(result.trackedDecks).toHaveLength(2);
      expect(result.trackedDecks[0]!.name).toBe('Deck B');
      expect(result.trackedDecks[1]!.name).toBe('Deck A');
      expect(result.trackedDecks[0]!.latestSnapshot?.effectivePercent).toBe(95);
      expect(result.trackedDecks[1]!.latestSnapshot?.effectivePercent).toBe(
        82.3,
      );
      expect(result.collectionCardCount).toBe(100);
    });
  });

  describe('getDetail — variantFetchProgress integration (Unit 5)', () => {
    function buildDeckCards(): DeckCardEntity[] {
      return [
        {
          id: 1,
          trackedDeckId: 1,
          cardIdentifier: 'card-a',
          quantity: 2,
          slot: 'main',
          trackedDeck: {} as DeckCardEntity['trackedDeck'],
        },
      ];
    }

    function buildSnapshotWithMissing(): DeckReadinessSnapshotEntity {
      return {
        id: 10,
        trackedDeckId: 1,
        rawPercent: 75,
        effectivePercent: 80,
        breakdown: {
          exact: [],
          substituted: [],
          missing: [{ cardIdentifier: 'card-a', quantity: 1, slot: 'main' }],
          notOwned: [{ cardIdentifier: 'card-a', quantity: 1, slot: 'main' }],
        },
        substitutions: {},
        computedAt: new Date('2025-01-15T10:05:00Z'),
        trackedDeck: {} as DeckReadinessSnapshotEntity['trackedDeck'],
      };
    }

    function buildPopulatedShoppingLine() {
      return {
        kind: 'populated' as const,
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
      };
    }

    it('should include variantFetchProgress on populated shopping line when a fetch is active', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      const snapshot = buildSnapshotWithMissing();
      const populatedLine = buildPopulatedShoppingLine();

      trackedDeckRepo.findOne.mockResolvedValue(deck);
      deckCardRepo.find.mockResolvedValue(buildDeckCards());
      snapshotRepo.findOne.mockResolvedValue(snapshot);
      decisionsService.countRejected.mockResolvedValue(0);
      decisionsService.list.mockResolvedValue([]);
      shoppingLineService.computeForBreakdown.mockResolvedValue(populatedLine);
      substitutionService.deriveSnapshotFields.mockReturnValue({
        path: 'C',
        fidelityPercent: 80,
      });

      variantFetchService.getProgress.mockReturnValue({
        fetchId: 'fetch-uuid-001',
        total: 1,
        completed: 0,
        failed: 0,
        inProgress: true,
        startedAt: new Date(),
        cards: new Map(),
        globalFailed: false,
      });

      // Act
      const result = await service.getDetail(USER_ID, 1);

      // Assert
      expect(result.shoppingLine).not.toBeNull();
      const sl = result.shoppingLine as { kind: string; variantFetchProgress?: object };
      expect(sl.kind).toBe('populated');
      expect(sl.variantFetchProgress).toEqual({
        fetchId: 'fetch-uuid-001',
        total: 1,
        completed: 0,
        failed: 0,
        inProgress: true,
        cards: {},
      });
      expect(variantFetchService.getProgress).toHaveBeenCalledWith('1');
    });

    it('(regression: getDetail bug fix) auto-recompute passes exclusion set when snapshot is missing', async () => {
      // Arrange: no existing snapshot → auto-recompute path triggered.
      const deck = buildTrackedDeck();

      trackedDeckRepo.findOne.mockResolvedValue(deck);
      deckCardRepo.find.mockResolvedValue(buildDeckCards());
      snapshotRepo.findOne.mockResolvedValue(null); // Force auto-recompute.

      // Simulate a rejected decision.
      const exclusions = new Set(['rejected-proxy-x']);
      decisionsService.loadExclusions.mockResolvedValue(exclusions);
      decisionsService.countRejected.mockResolvedValue(1);
      decisionsService.list.mockResolvedValue([{ cardIdentifier: 'rejected-proxy-x', decision: 'rejected' }]);

      const recomputedSnapshot = buildSnapshot({ id: 50, effectivePercent: 70 });
      substitutionService.computeAndStoreReadiness.mockResolvedValue(recomputedSnapshot);
      substitutionService.deriveSnapshotFields.mockReturnValue({ path: 'C', fidelityPercent: 70 });

      // Act
      await service.getDetail(USER_ID, 1);

      // Assert: exclusions were loaded and forwarded to computeAndStoreReadiness.
      expect(decisionsService.loadExclusions).toHaveBeenCalledWith(1);
      const exclusionsArg = (
        substitutionService.computeAndStoreReadiness as jest.Mock
      ).mock.calls[0][2] as Set<string>;
      expect(exclusionsArg.has('rejected-proxy-x')).toBe(true);
    });

    it('should serialize the per-card status Map to an object on variantFetchProgress', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      const snapshot = buildSnapshotWithMissing();
      const populatedLine = buildPopulatedShoppingLine();

      trackedDeckRepo.findOne.mockResolvedValue(deck);
      deckCardRepo.find.mockResolvedValue(buildDeckCards());
      snapshotRepo.findOne.mockResolvedValue(snapshot);
      decisionsService.countRejected.mockResolvedValue(0);
      decisionsService.list.mockResolvedValue([]);
      shoppingLineService.computeForBreakdown.mockResolvedValue(populatedLine);
      substitutionService.deriveSnapshotFields.mockReturnValue({
        path: 'C',
        fidelityPercent: 80,
      });

      variantFetchService.getProgress.mockReturnValue({
        fetchId: 'fetch-uuid-002',
        total: 2,
        completed: 1,
        failed: 1,
        inProgress: false,
        startedAt: new Date(),
        cards: new Map([
          ['card-a', 'done'],
          ['card-b', 'failed'],
        ]),
        globalFailed: false,
      });

      // Act
      const result = await service.getDetail(USER_ID, 1);

      // Assert
      const sl = result.shoppingLine as {
        variantFetchProgress?: {
          cards?: Record<string, string>;
        };
      };
      expect(sl.variantFetchProgress?.cards).toEqual({
        'card-a': 'done',
        'card-b': 'failed',
      });
    });

    it('should NOT include variantFetchProgress when no progress entry exists', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      const snapshot = buildSnapshotWithMissing();
      const populatedLine = buildPopulatedShoppingLine();

      trackedDeckRepo.findOne.mockResolvedValue(deck);
      deckCardRepo.find.mockResolvedValue(buildDeckCards());
      snapshotRepo.findOne.mockResolvedValue(snapshot);
      decisionsService.countRejected.mockResolvedValue(0);
      decisionsService.list.mockResolvedValue([]);
      shoppingLineService.computeForBreakdown.mockResolvedValue(populatedLine);
      substitutionService.deriveSnapshotFields.mockReturnValue({
        path: 'C',
        fidelityPercent: 80,
      });

      variantFetchService.getProgress.mockReturnValue(undefined);

      // Act
      const result = await service.getDetail(USER_ID, 1);

      // Assert
      expect(result.shoppingLine).not.toBeNull();
      const sl = result.shoppingLine as { kind: string; variantFetchProgress?: object };
      expect(sl.kind).toBe('populated');
      expect(sl.variantFetchProgress).toBeUndefined();
    });

    it('should NOT add variantFetchProgress to non-populated shopping lines (unscraped)', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      const snapshot = buildSnapshotWithMissing();

      trackedDeckRepo.findOne.mockResolvedValue(deck);
      deckCardRepo.find.mockResolvedValue(buildDeckCards());
      snapshotRepo.findOne.mockResolvedValue(snapshot);
      decisionsService.countRejected.mockResolvedValue(0);
      decisionsService.list.mockResolvedValue([]);
      shoppingLineService.computeForBreakdown.mockResolvedValue({
        kind: 'unscraped',
      });
      substitutionService.deriveSnapshotFields.mockReturnValue({
        path: 'C',
        fidelityPercent: 80,
      });

      variantFetchService.getProgress.mockReturnValue({
        fetchId: 'fetch-uuid-002',
        total: 1,
        completed: 0,
        failed: 0,
        inProgress: true,
        startedAt: new Date(),
        cards: new Map(),
        globalFailed: false,
      });

      // Act
      const result = await service.getDetail(USER_ID, 1);

      // Assert: unscraped kind should NOT get variantFetchProgress
      expect(result.shoppingLine).not.toBeNull();
      const sl = result.shoppingLine as { kind: string; variantFetchProgress?: object };
      expect(sl.kind).toBe('unscraped');
      expect(sl).not.toHaveProperty('variantFetchProgress');
    });

    it('should include rejectedCount, approvedCount, pendingCount, and decisions in response', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      const snapshot = buildSnapshotWithMissing();

      trackedDeckRepo.findOne.mockResolvedValue(deck);
      deckCardRepo.find.mockResolvedValue(buildDeckCards());
      snapshotRepo.findOne.mockResolvedValue(snapshot);
      decisionsService.countRejected.mockResolvedValue(1);
      decisionsService.list.mockResolvedValue([
        { cardIdentifier: 'card-a', decision: 'rejected' },
      ]);
      substitutionService.deriveSnapshotFields.mockReturnValue({
        path: 'C',
        fidelityPercent: 80,
      });

      // Act
      const result = await service.getDetail(USER_ID, 1);

      // Assert: new U9 fields present in response.
      expect(result.rejectedCount).toBe(1);
      expect(result.approvedCount).toBe(0);
      expect(typeof result.pendingCount).toBe('number');
      expect(result.decisions).toEqual([
        { cardIdentifier: 'card-a', decision: 'rejected' },
      ]);
    });
  });

  describe('untrack', () => {
    it('should assert ownership and delete the deck', async () => {
      // Arrange
      authzService.assertOwnsTrackedDeck.mockResolvedValue(undefined);
      trackedDeckRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      // Act
      await service.untrack(USER_ID, 1);

      // Assert
      expect(authzService.assertOwnsTrackedDeck).toHaveBeenCalledWith(
        USER_ID,
        1,
      );
      expect(trackedDeckRepo.delete).toHaveBeenCalledWith({
        id: 1,
        userId: USER_ID,
      });
    });

    it('should throw NotFoundException when user does not own the deck', async () => {
      // Arrange
      authzService.assertOwnsTrackedDeck.mockRejectedValue(
        new NotFoundException('Tracked deck not found'),
      );

      // Act & Assert
      await expect(service.untrack(OTHER_USER_ID, 1)).rejects.toThrow(
        NotFoundException,
      );
      expect(trackedDeckRepo.delete).not.toHaveBeenCalled();
    });
  });
});
