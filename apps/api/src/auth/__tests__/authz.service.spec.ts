import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { AuthzService } from '../authz.service';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { DeckTagEntity } from '../../database/entities/deck-tag.entity';

type MockRepository = Partial<Record<'findOne', jest.Mock>>;

function createMockRepository(): MockRepository {
  return {
    findOne: jest.fn(),
  };
}

describe('AuthzService', () => {
  let service: AuthzService;
  let trackedDeckRepo: MockRepository;
  let collectionCardRepo: MockRepository;
  let deckTagRepo: MockRepository;

  beforeEach(async () => {
    trackedDeckRepo = createMockRepository();
    collectionCardRepo = createMockRepository();
    deckTagRepo = createMockRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthzService,
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
        {
          provide: getRepositoryToken(CollectionCardEntity),
          useValue: collectionCardRepo,
        },
        {
          provide: getRepositoryToken(DeckTagEntity),
          useValue: deckTagRepo,
        },
      ],
    }).compile();

    service = module.get<AuthzService>(AuthzService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assertOwnsTrackedDeck', () => {
    const userId = 'user-uuid-123';
    const trackedDeckId = 42;

    it('should resolve when the user owns the tracked deck', async () => {
      // Arrange
      trackedDeckRepo.findOne!.mockResolvedValue({
        id: trackedDeckId,
        userId,
      });

      // Act & Assert
      await expect(
        service.assertOwnsTrackedDeck(userId, trackedDeckId),
      ).resolves.toBeUndefined();

      expect(trackedDeckRepo.findOne).toHaveBeenCalledWith({
        where: { id: trackedDeckId },
        select: ['id', 'userId'],
      });
    });

    it('should throw NotFoundException when the deck belongs to another user', async () => {
      // Arrange
      trackedDeckRepo.findOne!.mockResolvedValue({
        id: trackedDeckId,
        userId: 'other-user-uuid',
      });

      // Act & Assert
      await expect(
        service.assertOwnsTrackedDeck(userId, trackedDeckId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the deck does not exist', async () => {
      // Arrange
      trackedDeckRepo.findOne!.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assertOwnsTrackedDeck(userId, trackedDeckId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertOwnsCollectionCard', () => {
    const userId = 'user-uuid-456';
    const collectionCardId = 99;

    it('should resolve when the user owns the collection card', async () => {
      // Arrange
      collectionCardRepo.findOne!.mockResolvedValue({
        id: collectionCardId,
        userId,
      });

      // Act & Assert
      await expect(
        service.assertOwnsCollectionCard(userId, collectionCardId),
      ).resolves.toBeUndefined();

      expect(collectionCardRepo.findOne).toHaveBeenCalledWith({
        where: { id: collectionCardId },
        select: ['id', 'userId'],
      });
    });

    it('should throw NotFoundException when the card belongs to another user', async () => {
      // Arrange
      collectionCardRepo.findOne!.mockResolvedValue({
        id: collectionCardId,
        userId: 'other-user-uuid',
      });

      // Act & Assert
      await expect(
        service.assertOwnsCollectionCard(userId, collectionCardId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the card does not exist', async () => {
      // Arrange
      collectionCardRepo.findOne!.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assertOwnsCollectionCard(userId, collectionCardId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // assertOwnsTag
  // -------------------------------------------------------------------------
  describe('assertOwnsTag', () => {
    const userId = 'user-uuid-789';
    const tagId = 55;

    it('should resolve when the user owns the tag', async () => {
      // Arrange
      deckTagRepo.findOne!.mockResolvedValue({ id: tagId, userId });

      // Act & Assert
      await expect(
        service.assertOwnsTag(userId, tagId),
      ).resolves.toBeUndefined();

      expect(deckTagRepo.findOne).toHaveBeenCalledWith({
        where: { id: tagId },
        select: ['id', 'userId'],
      });
    });

    it('should throw NotFoundException when the tag belongs to another user', async () => {
      // Arrange
      deckTagRepo.findOne!.mockResolvedValue({
        id: tagId,
        userId: 'other-user-uuid',
      });

      // Act & Assert
      await expect(
        service.assertOwnsTag(userId, tagId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when the tag does not exist', async () => {
      // Arrange
      deckTagRepo.findOne!.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.assertOwnsTag(userId, tagId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use the provided EntityManager repo when a transaction manager is passed', async () => {
      // Arrange
      const mockManagerRepo = { findOne: jest.fn().mockResolvedValue({ id: tagId, userId }) };
      const mockManager = {
        getRepository: jest.fn().mockReturnValue(mockManagerRepo),
      };

      // Act & Assert
      await expect(
        service.assertOwnsTag(userId, tagId, mockManager as unknown as EntityManager),
      ).resolves.toBeUndefined();

      expect(mockManager.getRepository).toHaveBeenCalledWith(DeckTagEntity);
      expect(mockManagerRepo.findOne).toHaveBeenCalledWith({
        where: { id: tagId },
        select: ['id', 'userId'],
      });
      // The injected deckTagRepo should NOT have been called
      expect(deckTagRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
