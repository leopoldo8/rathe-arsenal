import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { RejectedSubstituteEntity } from '../../database/entities/rejected-substitute.entity';
import { AuthzService } from '../../auth/authz.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { ShoppingLineService } from '../../stores/shopping-line.service';
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
  let collectionCardRepo: jest.Mocked<Repository<CollectionCardEntity>>;
  let rejectedSubstituteRepo: jest.Mocked<Repository<RejectedSubstituteEntity>>;
  let authzService: jest.Mocked<AuthzService>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let shoppingLineService: jest.Mocked<ShoppingLineService>;

  beforeEach(async () => {
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    collectionCardRepo = createMock<Repository<CollectionCardEntity>>();
    rejectedSubstituteRepo = createMock<Repository<RejectedSubstituteEntity>>();
    authzService = createMock<AuthzService>();
    substitutionService = createMock<SubstitutionService>();
    shoppingLineService = createMock<ShoppingLineService>();

    // Default: shopping line returns null (Path A / no missing cards).
    shoppingLineService.computeForBreakdown.mockResolvedValue(null);

    // Default: no collection cards owned. Individual tests override as needed.
    collectionCardRepo.count.mockResolvedValue(0);

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
        {
          provide: getRepositoryToken(CollectionCardEntity),
          useValue: collectionCardRepo,
        },
        {
          provide: getRepositoryToken(RejectedSubstituteEntity),
          useValue: rejectedSubstituteRepo,
        },
        { provide: AuthzService, useValue: authzService },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: ShoppingLineService, useValue: shoppingLineService },
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
      collectionCardRepo.count.mockResolvedValue(0);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(result).toEqual({ trackedDecks: [], collectionCardCount: 0 });
      expect(trackedDeckRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        order: { trackedAt: 'DESC' },
      });
    });

    it('should return collectionCardCount when user has cards but no tracked decks', async () => {
      // Arrange
      trackedDeckRepo.find.mockResolvedValue([]);
      collectionCardRepo.count.mockResolvedValue(42);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(result.trackedDecks).toEqual([]);
      expect(result.collectionCardCount).toBe(42);
    });

    it('should scope collectionCardCount query to the authenticated userId only', async () => {
      // Arrange: cross-user isolation regression. The count query must filter by
      // userId so one user never sees another user's collection size.
      trackedDeckRepo.find.mockResolvedValue([]);
      collectionCardRepo.count.mockResolvedValue(7);

      // Act
      await service.listForUser(USER_ID);

      // Assert
      expect(collectionCardRepo.count).toHaveBeenCalledWith({
        where: { userId: USER_ID },
      });
      expect(collectionCardRepo.count).toHaveBeenCalledTimes(1);
    });

    it('should return tracked decks with their latest snapshot and collectionCardCount', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      const snapshot = buildSnapshot();
      trackedDeckRepo.find.mockResolvedValue([deck]);
      collectionCardRepo.count.mockResolvedValue(15);

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
      collectionCardRepo.count.mockResolvedValue(3);

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
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(
        deck.id,
        USER_ID,
      );
      expect(result.collectionCardCount).toBe(3);
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
      collectionCardRepo.count.mockResolvedValue(100);

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
