import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DeckTagEntity } from '../../database/entities/deck-tag.entity';
import { AuthzService } from '../../auth/authz.service';
import { TagsService } from '../tags.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MockTagRepo = {
  count: jest.Mock;
  createQueryBuilder: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  delete: jest.Mock;
};

function buildMockQueryBuilder(result: DeckTagEntity | null) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result ? [result] : []),
    getOne: jest.fn().mockResolvedValue(result),
  };
  return qb;
}

function buildMockListQueryBuilder(results: DeckTagEntity[]) {
  const qb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(results),
    getOne: jest.fn().mockResolvedValue(null),
  };
  return qb;
}

function createMockTagRepo(): MockTagRepo {
  return {
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('TagsService', () => {
  let service: TagsService;
  let tagRepo: MockTagRepo;
  let authzService: jest.Mocked<AuthzService>;

  beforeEach(async () => {
    tagRepo = createMockTagRepo();
    authzService = createMock<AuthzService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        {
          provide: getRepositoryToken(DeckTagEntity),
          useValue: tagRepo,
        },
        {
          provide: AuthzService,
          useValue: authzService,
        },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns tags for the user ordered by name', async () => {
      // Arrange
      const userId = 'user-uuid-1';
      const mockTags: DeckTagEntity[] = [
        { id: 1, userId, name: 'alpha', createdAt: new Date('2024-01-01') } as DeckTagEntity,
        { id: 2, userId, name: 'Beta', createdAt: new Date('2024-01-02') } as DeckTagEntity,
      ];
      const qb = buildMockListQueryBuilder(mockTags);
      tagRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.list(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]!).toEqual({ id: 1, name: 'alpha', createdAt: mockTags[0]!.createdAt });
      expect(result[1]!).toEqual({ id: 2, name: 'Beta', createdAt: mockTags[1]!.createdAt });
    });

    it('returns empty array when user has no tags', async () => {
      // Arrange
      const userId = 'user-uuid-2';
      const qb = buildMockListQueryBuilder([]);
      tagRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.list(userId);

      // Assert
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    const userId = 'user-uuid-3';
    const tagName = 'liga local';

    it('creates and returns a tag when all conditions are met', async () => {
      // Arrange
      tagRepo.count.mockResolvedValue(0);
      const noMatchQb = buildMockQueryBuilder(null);
      tagRepo.createQueryBuilder.mockReturnValue(noMatchQb);

      const savedTag: DeckTagEntity = {
        id: 10,
        userId,
        name: tagName,
        createdAt: new Date('2024-06-01'),
      } as DeckTagEntity;

      tagRepo.create.mockReturnValue(savedTag);
      tagRepo.save.mockResolvedValue(savedTag);

      // Act
      const result = await service.create(userId, tagName);

      // Assert
      expect(result).toEqual({ id: 10, name: tagName, createdAt: savedTag.createdAt });
      expect(tagRepo.create).toHaveBeenCalledWith({ userId, name: tagName });
      expect(tagRepo.save).toHaveBeenCalled();
    });

    it('creates a tag with accented characters (café)', async () => {
      // Arrange
      const accentedName = 'café';
      tagRepo.count.mockResolvedValue(0);
      const noMatchQb = buildMockQueryBuilder(null);
      tagRepo.createQueryBuilder.mockReturnValue(noMatchQb);

      const savedTag: DeckTagEntity = {
        id: 11,
        userId,
        name: accentedName,
        createdAt: new Date(),
      } as DeckTagEntity;

      tagRepo.create.mockReturnValue(savedTag);
      tagRepo.save.mockResolvedValue(savedTag);

      // Act
      const result = await service.create(userId, accentedName);

      // Assert
      expect(result.name).toBe(accentedName);
    });

    it('throws UnprocessableEntityException when user has 200 tags (cap exceeded)', async () => {
      // Arrange
      tagRepo.count.mockResolvedValue(200);

      // Act & Assert
      await expect(service.create(userId, tagName)).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(tagRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(tagRepo.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException on case-insensitive duplicate name', async () => {
      // Arrange
      tagRepo.count.mockResolvedValue(5);

      // "liga local" already exists; the case-insensitive check returns it
      const existingTag: DeckTagEntity = {
        id: 5,
        userId,
        name: 'liga local',
        createdAt: new Date(),
      } as DeckTagEntity;

      const duplicateQb = buildMockQueryBuilder(existingTag);
      tagRepo.createQueryBuilder.mockReturnValue(duplicateQb);

      // Act & Assert — posting "Liga Local" should conflict
      await expect(service.create(userId, 'Liga Local')).rejects.toThrow(
        ConflictException,
      );
      expect(tagRepo.save).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    const userId = 'user-uuid-4';
    const tagId = 42;

    it('deletes the tag when user owns it', async () => {
      // Arrange
      authzService.assertOwnsTag.mockResolvedValue(undefined);
      tagRepo.delete.mockResolvedValue({ affected: 1 });

      // Act
      await service.remove(userId, tagId);

      // Assert
      expect(authzService.assertOwnsTag).toHaveBeenCalledWith(userId, tagId);
      expect(tagRepo.delete).toHaveBeenCalledWith({ id: tagId, userId });
    });

    it('throws NotFoundException when the tag belongs to another user', async () => {
      // Arrange
      authzService.assertOwnsTag.mockRejectedValue(
        new NotFoundException('Tag not found'),
      );

      // Act & Assert
      await expect(service.remove(userId, tagId)).rejects.toThrow(
        NotFoundException,
      );
      expect(tagRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the tag does not exist', async () => {
      // Arrange
      authzService.assertOwnsTag.mockRejectedValue(
        new NotFoundException('Tag not found'),
      );

      // Act & Assert
      await expect(service.remove(userId, 999)).rejects.toThrow(NotFoundException);
    });
  });
});
