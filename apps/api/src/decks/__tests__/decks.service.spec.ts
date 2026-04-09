import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../auth/authz.service';
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
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let authzService: jest.Mocked<AuthzService>;

  beforeEach(async () => {
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    authzService = createMock<AuthzService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksService,
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
        {
          provide: getRepositoryToken(DeckReadinessSnapshotEntity),
          useValue: snapshotRepo,
        },
        { provide: AuthzService, useValue: authzService },
      ],
    }).compile();

    service = module.get<DecksService>(DecksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listForUser', () => {
    it('should return an empty array when user has no tracked decks', async () => {
      // Arrange
      trackedDeckRepo.find.mockResolvedValue([]);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(result).toEqual([]);
      expect(trackedDeckRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        order: { trackedAt: 'DESC' },
      });
    });

    it('should return tracked decks with their latest snapshot', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      const snapshot = buildSnapshot();
      trackedDeckRepo.find.mockResolvedValue([deck]);

      const qb = createMock<SelectQueryBuilder<DeckReadinessSnapshotEntity>>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getMany.mockResolvedValue([snapshot]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
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

    it('should return null latestSnapshot when no snapshot exists for a deck', async () => {
      // Arrange
      const deck = buildTrackedDeck();
      trackedDeckRepo.find.mockResolvedValue([deck]);

      const qb = createMock<SelectQueryBuilder<DeckReadinessSnapshotEntity>>();
      qb.where.mockReturnThis();
      qb.andWhere.mockReturnThis();
      qb.getMany.mockResolvedValue([]);
      snapshotRepo.createQueryBuilder.mockReturnValue(qb);

      // Act
      const result = await service.listForUser(USER_ID);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]!.latestSnapshot).toBeNull();
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
      expect(result).toHaveLength(2);
      expect(result[0]!.name).toBe('Deck B');
      expect(result[1]!.name).toBe('Deck A');
      expect(result[0]!.latestSnapshot?.effectivePercent).toBe(95);
      expect(result[1]!.latestSnapshot?.effectivePercent).toBe(82.3);
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
