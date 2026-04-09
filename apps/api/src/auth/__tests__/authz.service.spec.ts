import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthzService } from '../authz.service';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';

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

  beforeEach(async () => {
    trackedDeckRepo = createMockRepository();
    collectionCardRepo = createMockRepository();

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
});
