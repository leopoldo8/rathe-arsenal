import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CardNotFoundError } from '@rathe-arsenal/engine';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { AuthzService } from '../../auth/authz.service';
import { CatalogService } from '../../catalog/catalog.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { DecisionsService } from '../../decks/decisions/decisions.service';
import { CollectionService } from '../collection.service';

const USER_ID = 'user-uuid-123';
const DECK_ID = 1;
const CARD_IDENTIFIER = 'WTR001';

function buildSnapshot(
  overrides: Partial<DeckReadinessSnapshotEntity> = {},
): DeckReadinessSnapshotEntity {
  return {
    id: 10,
    trackedDeckId: DECK_ID,
    rawPercent: 75.5,
    effectivePercent: 82.3,
    breakdown: {
      exact: [{ cardIdentifier: 'WTR002', quantity: 3, slot: 'mainboard' }],
      substituted: [],
      missing: [{ cardIdentifier: CARD_IDENTIFIER, quantity: 3, slot: 'mainboard' }],
    },
    substitutions: {},
    computedAt: new Date('2025-01-15T10:05:00Z'),
    trackedDeck: {} as DeckReadinessSnapshotEntity['trackedDeck'],
    ...overrides,
  };
}

function buildDeckCard(
  overrides: Partial<DeckCardEntity> = {},
): DeckCardEntity {
  return {
    id: 100,
    trackedDeckId: DECK_ID,
    cardIdentifier: CARD_IDENTIFIER,
    quantity: 3,
    slot: 'mainboard',
    trackedDeck: {} as DeckCardEntity['trackedDeck'],
    ...overrides,
  };
}

function buildCollectionCard(
  overrides: Partial<CollectionCardEntity> = {},
): CollectionCardEntity {
  return {
    id: 50,
    userId: USER_ID,
    cardIdentifier: CARD_IDENTIFIER,
    quantity: 1,
    lastUpdated: new Date('2025-01-15T10:00:00Z'),
    user: {} as CollectionCardEntity['user'],
    ...overrides,
  };
}

describe('CollectionService', () => {
  let service: CollectionService;
  let collectionCardRepo: jest.Mocked<Repository<CollectionCardEntity>>;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let authzService: jest.Mocked<AuthzService>;
  let catalogService: jest.Mocked<CatalogService>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let decisionsService: jest.Mocked<DecisionsService>;

  beforeEach(async () => {
    collectionCardRepo = createMock<Repository<CollectionCardEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    authzService = createMock<AuthzService>();
    catalogService = createMock<CatalogService>();
    substitutionService = createMock<SubstitutionService>();
    decisionsService = createMock<DecisionsService>();

    // Default: no rejections — exclusion set is empty.
    decisionsService.loadExclusions.mockResolvedValue(new Set());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionService,
        {
          provide: getRepositoryToken(CollectionCardEntity),
          useValue: collectionCardRepo,
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
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
        { provide: AuthzService, useValue: authzService },
        { provide: CatalogService, useValue: catalogService },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: DecisionsService, useValue: decisionsService },
      ],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('markOwned', () => {
    it('should mark a missing card as owned and return new snapshot', async () => {
      // Arrange
      const snapshot = buildSnapshot();
      const deckCard = buildDeckCard();
      const newSnapshot = buildSnapshot({
        id: 11,
        rawPercent: 80,
        effectivePercent: 88,
        breakdown: {
          exact: [
            { cardIdentifier: 'WTR002', quantity: 3, slot: 'mainboard' },
            { cardIdentifier: CARD_IDENTIFIER, quantity: 1, slot: 'mainboard' },
          ],
          substituted: [],
          missing: [{ cardIdentifier: CARD_IDENTIFIER, quantity: 2, slot: 'mainboard' }],
        },
        computedAt: new Date('2025-01-15T10:10:00Z'),
      });

      authzService.assertOwnsTrackedDeck.mockResolvedValue(undefined);
      snapshotRepo.findOne.mockResolvedValue(snapshot);
      deckCardRepo.find.mockResolvedValue([deckCard]);
      collectionCardRepo.findOne.mockResolvedValue(null);
      collectionCardRepo.create.mockReturnValue(
        buildCollectionCard({ quantity: 1 }),
      );
      collectionCardRepo.save.mockResolvedValue(
        buildCollectionCard({ quantity: 1 }),
      );
      substitutionService.computeAndStoreReadiness.mockResolvedValue(
        newSnapshot,
      );

      // Act
      const result = await service.markOwned(USER_ID, DECK_ID, CARD_IDENTIFIER);

      // Assert
      expect(result.cardIdentifier).toBe(CARD_IDENTIFIER);
      expect(result.newQuantity).toBe(1);
      expect(result.snapshot.id).toBe(11);
      expect(result.snapshot.effectivePercent).toBe(88);
      expect(authzService.assertOwnsTrackedDeck).toHaveBeenCalledWith(
        USER_ID,
        DECK_ID,
      );
      // U9: exclusions loaded from decisionsService, not from rejected_substitute.
      expect(decisionsService.loadExclusions).toHaveBeenCalledWith(DECK_ID);
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        new Set(),
      );
    });

    it('(regression: markOwned auto-recompute) respects rejected decisions in exclusion set', async () => {
      // Arrange: a rejection exists — it must appear in the exclusion set passed to recompute.
      const deckCard = buildDeckCard();
      const newSnapshot = buildSnapshot({ id: 20 });

      authzService.assertOwnsTrackedDeck.mockResolvedValue(undefined);
      deckCardRepo.find.mockResolvedValue([deckCard]);
      collectionCardRepo.findOne.mockResolvedValue(null);
      collectionCardRepo.create.mockReturnValue(buildCollectionCard({ quantity: 1 }));
      collectionCardRepo.save.mockResolvedValue(buildCollectionCard({ quantity: 1 }));

      // Simulate one rejected card.
      const exclusions = new Set(['rejected-proxy']);
      decisionsService.loadExclusions.mockResolvedValue(exclusions);
      substitutionService.computeAndStoreReadiness.mockResolvedValue(newSnapshot);

      // Act
      await service.markOwned(USER_ID, DECK_ID, CARD_IDENTIFIER);

      // Assert: exclusion set forwarded.
      expect(decisionsService.loadExclusions).toHaveBeenCalledWith(DECK_ID);
      const exclusionsArg = (
        substitutionService.computeAndStoreReadiness as jest.Mock
      ).mock.calls[0][2] as Set<string>;
      expect(exclusionsArg.has('rejected-proxy')).toBe(true);
    });

    it('should throw BadRequestException when card is not part of the deck', async () => {
      // Arrange — deck has no cards matching the requested identifier
      authzService.assertOwnsTrackedDeck.mockResolvedValue(undefined);
      deckCardRepo.find.mockResolvedValue([
        buildDeckCard({ cardIdentifier: 'OTHER_CARD' }),
      ]);

      // Act & Assert
      await expect(
        service.markOwned(USER_ID, DECK_ID, CARD_IDENTIFIER),
      ).rejects.toThrow(BadRequestException);
      expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not own the deck', async () => {
      // Arrange
      authzService.assertOwnsTrackedDeck.mockRejectedValue(
        new NotFoundException('Tracked deck not found'),
      );

      // Act & Assert
      await expect(
        service.markOwned('wrong-user-id', DECK_ID, CARD_IDENTIFIER),
      ).rejects.toThrow(NotFoundException);
      expect(deckCardRepo.find).not.toHaveBeenCalled();
    });

    it('should cap quantity at deck required quantity when incrementing', async () => {
      // Arrange
      const snapshot = buildSnapshot();
      const deckCard = buildDeckCard({ quantity: 2 });
      const existingCard = buildCollectionCard({ quantity: 2 });
      const newSnapshot = buildSnapshot({
        id: 12,
        computedAt: new Date('2025-01-15T10:15:00Z'),
      });

      authzService.assertOwnsTrackedDeck.mockResolvedValue(undefined);
      snapshotRepo.findOne.mockResolvedValue(snapshot);
      deckCardRepo.find.mockResolvedValue([deckCard]);
      collectionCardRepo.findOne.mockResolvedValue(existingCard);
      substitutionService.computeAndStoreReadiness.mockResolvedValue(
        newSnapshot,
      );

      // Act
      const result = await service.markOwned(USER_ID, DECK_ID, CARD_IDENTIFIER);

      // Assert
      // existing qty is 2, required qty is 2, so capped at 2
      expect(result.newQuantity).toBe(2);
      expect(collectionCardRepo.update).toHaveBeenCalledWith(existingCard.id, {
        quantity: 2,
      });
    });
  });

  describe('addCard', () => {
    function mockAffectedDeckIds(deckIds: readonly number[]): void {
      const rawRows = deckIds.map((id) => ({ trackedDeckId: id }));
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawRows),
      };
      (
        deckCardRepo as unknown as {
          createQueryBuilder: jest.Mock;
        }
      ).createQueryBuilder = jest.fn().mockReturnValue(qb);
    }

    it('should create a new CollectionCard row with default quantity 1', async () => {
      // Arrange
      catalogService.getCard.mockReturnValue({} as never);
      collectionCardRepo.findOne.mockResolvedValue(null);
      collectionCardRepo.create.mockReturnValue(
        buildCollectionCard({ quantity: 1 }),
      );
      collectionCardRepo.save.mockResolvedValue(
        buildCollectionCard({ quantity: 1 }),
      );
      mockAffectedDeckIds([]);

      // Act
      const result = await service.addCard(USER_ID, CARD_IDENTIFIER);

      // Assert
      expect(result.cardIdentifier).toBe(CARD_IDENTIFIER);
      expect(result.newQuantity).toBe(1);
      expect(result.recomputedDecks).toEqual([]);
      expect(catalogService.getCard).toHaveBeenCalledWith(CARD_IDENTIFIER);
      expect(collectionCardRepo.create).toHaveBeenCalledWith({
        userId: USER_ID,
        cardIdentifier: CARD_IDENTIFIER,
        quantity: 1,
      });
      expect(collectionCardRepo.save).toHaveBeenCalled();
      expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
    });

    it('should increment quantity when card already exists in collection', async () => {
      // Arrange
      catalogService.getCard.mockReturnValue({} as never);
      const existing = buildCollectionCard({ quantity: 2 });
      collectionCardRepo.findOne.mockResolvedValue(existing);
      mockAffectedDeckIds([]);

      // Act
      const result = await service.addCard(USER_ID, CARD_IDENTIFIER, 1);

      // Assert
      expect(result.newQuantity).toBe(3);
      expect(collectionCardRepo.update).toHaveBeenCalledWith(existing.id, {
        quantity: 3,
      });
      expect(collectionCardRepo.save).not.toHaveBeenCalled();
    });

    it('should cap quantity at the hard limit when incrementing beyond it', async () => {
      // Arrange
      catalogService.getCard.mockReturnValue({} as never);
      const existing = buildCollectionCard({ quantity: 19 });
      collectionCardRepo.findOne.mockResolvedValue(existing);
      mockAffectedDeckIds([]);

      // Act
      const result = await service.addCard(USER_ID, CARD_IDENTIFIER, 5);

      // Assert
      expect(result.newQuantity).toBe(20);
      expect(collectionCardRepo.update).toHaveBeenCalledWith(existing.id, {
        quantity: 20,
      });
    });

    it('should throw BadRequestException with INVALID_CARD_IDENTIFIER for unknown card', async () => {
      // Arrange
      catalogService.getCard.mockImplementation(() => {
        throw new CardNotFoundError('not-a-real-card');
      });

      // Act & Assert
      await expect(
        service.addCard(USER_ID, 'not-a-real-card'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_CARD_IDENTIFIER' }),
      });
      expect(collectionCardRepo.findOne).not.toHaveBeenCalled();
      expect(collectionCardRepo.save).not.toHaveBeenCalled();
      expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
    });

    it('triggers recompute for every affected tracked deck (cross-deck fan-out)', async () => {
      // Arrange — card is in 3 decks owned by this user
      catalogService.getCard.mockReturnValue({} as never);
      collectionCardRepo.findOne.mockResolvedValue(null);
      collectionCardRepo.create.mockReturnValue(
        buildCollectionCard({ quantity: 1 }),
      );
      collectionCardRepo.save.mockResolvedValue(
        buildCollectionCard({ quantity: 1 }),
      );
      mockAffectedDeckIds([1, 2, 3]);

      substitutionService.computeAndStoreReadiness
        .mockResolvedValueOnce(buildSnapshot({ id: 101, trackedDeckId: 1, effectivePercent: 90 }))
        .mockResolvedValueOnce(buildSnapshot({ id: 102, trackedDeckId: 2, effectivePercent: 85 }))
        .mockResolvedValueOnce(buildSnapshot({ id: 103, trackedDeckId: 3, effectivePercent: 70 }));

      // Act
      const result = await service.addCard(USER_ID, CARD_IDENTIFIER);

      // Assert
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(3);
      // Exclusions loaded per deck from decisionsService (not rejected_substitute).
      expect(decisionsService.loadExclusions).toHaveBeenCalledTimes(3);
      expect(result.recomputedDecks).toHaveLength(3);
      expect(result.recomputedDecks[0]).toEqual({
        trackedDeckId: 1,
        rawPercent: 75.5,
        effectivePercent: 90,
      });
    });

    it('triggers zero recomputes when the card is not in any tracked deck', async () => {
      // Arrange
      catalogService.getCard.mockReturnValue({} as never);
      collectionCardRepo.findOne.mockResolvedValue(null);
      collectionCardRepo.create.mockReturnValue(
        buildCollectionCard({ quantity: 1 }),
      );
      collectionCardRepo.save.mockResolvedValue(
        buildCollectionCard({ quantity: 1 }),
      );
      mockAffectedDeckIds([]);

      // Act
      const result = await service.addCard(USER_ID, CARD_IDENTIFIER);

      // Assert
      expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
      expect(result.recomputedDecks).toEqual([]);
    });

    it('continues recomputing the remaining decks when one recompute fails', async () => {
      // Arrange — critical: a mid-loop failure must NOT abort the loop or
      // roll back the collection upsert; the DB change is already committed.
      catalogService.getCard.mockReturnValue({} as never);
      collectionCardRepo.findOne.mockResolvedValue(null);
      collectionCardRepo.create.mockReturnValue(
        buildCollectionCard({ quantity: 1 }),
      );
      collectionCardRepo.save.mockResolvedValue(
        buildCollectionCard({ quantity: 1 }),
      );
      mockAffectedDeckIds([1, 2, 3]);

      substitutionService.computeAndStoreReadiness
        .mockResolvedValueOnce(buildSnapshot({ id: 101, trackedDeckId: 1 }))
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce(buildSnapshot({ id: 103, trackedDeckId: 3 }));

      // Act
      const result = await service.addCard(USER_ID, CARD_IDENTIFIER);

      // Assert
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(3);
      // The failed deck is simply omitted from the response.
      expect(result.recomputedDecks).toHaveLength(2);
      expect(result.recomputedDecks.map((d) => d.trackedDeckId)).toEqual([1, 3]);
      // Collection upsert still persisted.
      expect(collectionCardRepo.save).toHaveBeenCalled();
    });

    it('scopes the affected-decks query to the requesting user (cross-user isolation)', async () => {
      // Arrange
      catalogService.getCard.mockReturnValue({} as never);
      collectionCardRepo.findOne.mockResolvedValue(null);
      collectionCardRepo.create.mockReturnValue(
        buildCollectionCard({ quantity: 1 }),
      );
      collectionCardRepo.save.mockResolvedValue(
        buildCollectionCard({ quantity: 1 }),
      );

      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      (
        deckCardRepo as unknown as { createQueryBuilder: jest.Mock }
      ).createQueryBuilder = jest.fn().mockReturnValue(qb);

      // Act
      await service.addCard(USER_ID, CARD_IDENTIFIER);

      // Assert — the JOIN clause must include userId so other users' decks
      // are never recomputed or leaked.
      expect(qb.innerJoin).toHaveBeenCalledWith(
        TrackedDeckEntity,
        'td',
        expect.stringContaining('td.userId = :userId'),
        expect.objectContaining({ userId: USER_ID }),
      );
      expect(qb.where).toHaveBeenCalledWith(
        'dc.cardIdentifier = :cardIdentifier',
        { cardIdentifier: CARD_IDENTIFIER },
      );
    });
  });
});
