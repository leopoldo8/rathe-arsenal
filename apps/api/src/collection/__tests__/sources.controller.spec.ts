/**
 * Unit tests for SourcesController (U9).
 *
 * Mocks SourcesService so the controller's routing/parsing logic can be tested
 * in isolation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { SourcesService } from '../sources/sources.service';
import { SourcesController } from '../sources/sources.controller';
import { PatchSourceDto } from '../sources/dtos/patch-source.dto';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-uuid-ctrl-001';
const CSV_SOURCE_ID = 'csv-source-ctrl-uuid-001';

const mockCurrentUser: ICurrentUser = { userId: USER_ID, email: 'test@example.com' };

function buildSource(overrides: Partial<CsvSourceEntity> = {}): CsvSourceEntity {
  return {
    id: CSV_SOURCE_ID,
    userId: USER_ID,
    kind: 'csv',
    label: 'My Collection',
    originalFilename: 'collection.csv',
    sourceUrl: null,
    contentHash: 'abc123',
    cardCount: 10,
    active: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    user: {} as CsvSourceEntity['user'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SourcesController', () => {
  let controller: SourcesController;
  let sourcesService: jest.Mocked<SourcesService>;

  beforeEach(async () => {
    sourcesService = createMock<SourcesService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SourcesController],
      providers: [{ provide: SourcesService, useValue: sourcesService }],
    }).compile();

    controller = module.get<SourcesController>(SourcesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // GET /api/collection/sources
  // ---------------------------------------------------------------------------

  describe('list', () => {
    it('returns all csv sources for the user', async () => {
      // Arrange
      const sources = [buildSource(), buildSource({ id: 'src-2' })];
      sourcesService.list.mockResolvedValue(sources);

      // Act
      const result = await controller.list(mockCurrentUser);

      // Assert
      expect(sourcesService.list).toHaveBeenCalledWith(USER_ID);
      expect(result).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/collection/sources/:id
  // ---------------------------------------------------------------------------

  describe('patch', () => {
    it('toggles active via service', async () => {
      // Arrange
      const updated = buildSource({ active: false });
      sourcesService.patch.mockResolvedValue(updated);

      const dto: PatchSourceDto = { active: false };

      // Act
      const result = await controller.patch(CSV_SOURCE_ID, dto, mockCurrentUser);

      // Assert
      expect(sourcesService.patch).toHaveBeenCalledWith(USER_ID, CSV_SOURCE_ID, {
        active: false,
        label: undefined,
      });
      expect(result.active).toBe(false);
    });

    it('renames via service', async () => {
      // Arrange
      const updated = buildSource({ label: 'New Name' });
      sourcesService.patch.mockResolvedValue(updated);

      const dto: PatchSourceDto = { label: 'New Name' };

      // Act
      const result = await controller.patch(CSV_SOURCE_ID, dto, mockCurrentUser);

      // Assert
      expect(sourcesService.patch).toHaveBeenCalledWith(USER_ID, CSV_SOURCE_ID, {
        active: undefined,
        label: 'New Name',
      });
      expect(result.label).toBe('New Name');
    });

    it('propagates NotFoundException from service', async () => {
      // Arrange
      sourcesService.patch.mockRejectedValue(new NotFoundException('CSV source not found'));

      // Act & Assert
      await expect(
        controller.patch(CSV_SOURCE_ID, {}, mockCurrentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/collection/sources/:id
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    it('calls previewDelete when ?preview=true', async () => {
      // Arrange
      const preview = {
        cardsRemoved: 5,
        affectedDecks: [{ id: 1, name: 'Deck A', currentEffectivePercent: 80 }],
      };
      sourcesService.previewDelete.mockResolvedValue(preview);

      // Act
      const result = await controller.delete(CSV_SOURCE_ID, 'true', mockCurrentUser);

      // Assert
      expect(sourcesService.previewDelete).toHaveBeenCalledWith(USER_ID, CSV_SOURCE_ID);
      expect(sourcesService.delete).not.toHaveBeenCalled();
      expect(result).toEqual(preview);
    });

    it('calls previewDelete when ?preview=1', async () => {
      // Arrange
      sourcesService.previewDelete.mockResolvedValue({ cardsRemoved: 0, affectedDecks: [] });

      // Act
      await controller.delete(CSV_SOURCE_ID, '1', mockCurrentUser);

      // Assert
      expect(sourcesService.previewDelete).toHaveBeenCalled();
      expect(sourcesService.delete).not.toHaveBeenCalled();
    });

    it('calls delete when preview is absent', async () => {
      // Arrange
      sourcesService.delete.mockResolvedValue({ deleted: true });

      // Act
      const result = await controller.delete(CSV_SOURCE_ID, undefined, mockCurrentUser);

      // Assert
      expect(sourcesService.delete).toHaveBeenCalledWith(USER_ID, CSV_SOURCE_ID);
      expect(sourcesService.previewDelete).not.toHaveBeenCalled();
      expect(result).toEqual({ deleted: true });
    });

    it('returns recomputeWarning:true when delete has a recompute failure', async () => {
      // Arrange
      sourcesService.delete.mockResolvedValue({ deleted: true, recomputeWarning: true });

      // Act
      const result = await controller.delete(CSV_SOURCE_ID, undefined, mockCurrentUser);

      // Assert
      expect(result).toEqual({ deleted: true, recomputeWarning: true });
    });
  });
});
