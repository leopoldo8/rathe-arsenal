import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../auth/authz.service';
import { SubstitutionService } from '../../substitution/substitution.service';
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
  let authzService: jest.Mocked<AuthzService>;
  let substitutionService: jest.Mocked<SubstitutionService>;

  beforeEach(async () => {
    collectionCardRepo = createMock<Repository<CollectionCardEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    authzService = createMock<AuthzService>();
    substitutionService = createMock<SubstitutionService>();

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
        { provide: AuthzService, useValue: authzService },
        { provide: SubstitutionService, useValue: substitutionService },
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
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
      );
    });

    it('should throw BadRequestException when card is not in missing list', async () => {
      // Arrange
      const snapshot = buildSnapshot({
        breakdown: {
          exact: [{ cardIdentifier: CARD_IDENTIFIER, quantity: 3, slot: 'mainboard' }],
          substituted: [],
          missing: [],
        },
      });

      authzService.assertOwnsTrackedDeck.mockResolvedValue(undefined);
      snapshotRepo.findOne.mockResolvedValue(snapshot);

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
      expect(snapshotRepo.findOne).not.toHaveBeenCalled();
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
});
