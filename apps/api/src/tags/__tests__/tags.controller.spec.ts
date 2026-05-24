import 'reflect-metadata';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { TagsController } from '../tags.controller';
import { TagsService } from '../tags.service';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { ITagResponse } from '../dto/tag-response.dto';

// Throttler metadata keys used by the @Throttle decorator (v6 internals).
// The decorator calls: Reflect.defineMetadata('THROTTLER:LIMIT' + name, limit, fn)
// So for name='default': key = 'THROTTLER:LIMITdefault'.
const THROTTLER_LIMIT_KEY = 'THROTTLER:LIMITdefault';
const THROTTLER_TTL_KEY = 'THROTTLER:TTLdefault';
const MINUTE_MS = 60 * 1000;

const MOCK_USER: ICurrentUser = { userId: 'user-uuid-test', email: 'test@test.local' };

describe('TagsController', () => {
  let controller: TagsController;
  let tagsService: jest.Mocked<TagsService>;

  beforeEach(async () => {
    tagsService = createMock<TagsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagsController],
      providers: [
        { provide: TagsService, useValue: tagsService },
      ],
    }).compile();

    controller = module.get<TagsController>(TagsController);
  });

  afterEach(() => jest.clearAllMocks());

  // -------------------------------------------------------------------------
  // GET /tags
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('delegates to tagsService.list with the current user id', async () => {
      // Arrange
      const expected: ITagResponse[] = [
        { id: 1, name: 'liga local', createdAt: new Date() },
      ];
      tagsService.list.mockResolvedValue(expected);

      // Act
      const result = await controller.list(MOCK_USER);

      // Assert
      expect(tagsService.list).toHaveBeenCalledWith(MOCK_USER.userId);
      expect(result).toEqual({ tags: expected });
    });
  });

  // -------------------------------------------------------------------------
  // POST /tags
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('delegates to tagsService.create with userId and name', async () => {
      // Arrange
      const dto = { name: 'liga local' };
      const expected: ITagResponse = { id: 10, name: 'liga local', createdAt: new Date() };
      tagsService.create.mockResolvedValue(expected);

      // Act
      const result = await controller.create(MOCK_USER, dto);

      // Assert
      expect(tagsService.create).toHaveBeenCalledWith(MOCK_USER.userId, dto.name);
      expect(result).toBe(expected);
    });

    it('propagates ConflictException from service (case-insensitive duplicate)', async () => {
      // Arrange
      tagsService.create.mockRejectedValue(new ConflictException('A tag named "liga local" already exists'));

      // Act & Assert
      await expect(controller.create(MOCK_USER, { name: 'Liga Local' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('propagates UnprocessableEntityException from service (200-cap exceeded)', async () => {
      // Arrange
      tagsService.create.mockRejectedValue(
        new UnprocessableEntityException('You have reached the maximum of 200 tags'),
      );

      // Act & Assert
      await expect(controller.create(MOCK_USER, { name: 'overflow' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('has @Throttle({ default: { limit: 30, ttl: 60000 } }) applied on the POST handler', () => {
      // Verify the POST handler has the per-route throttle override (30/min).
      // This ensures the 429 protection on the 31st request within 60s is wired.
      // The @Throttle decorator from @nestjs/throttler v6 stores metadata directly
      // on the handler function using Reflect.defineMetadata.
      const limit = Reflect.getMetadata(THROTTLER_LIMIT_KEY, controller.create);
      const ttl = Reflect.getMetadata(THROTTLER_TTL_KEY, controller.create);

      expect(limit).toBe(30);
      expect(ttl).toBe(MINUTE_MS);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /tags/:id
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('delegates to tagsService.remove with userId and id', async () => {
      // Arrange
      tagsService.remove.mockResolvedValue(undefined);

      // Act
      await controller.remove(MOCK_USER, 42);

      // Assert
      expect(tagsService.remove).toHaveBeenCalledWith(MOCK_USER.userId, 42);
    });

    it('propagates NotFoundException (tag not owned by user)', async () => {
      // Arrange
      tagsService.remove.mockRejectedValue(new NotFoundException('Tag not found'));

      // Act & Assert
      await expect(controller.remove(MOCK_USER, 999)).rejects.toThrow(NotFoundException);
    });
  });
});
