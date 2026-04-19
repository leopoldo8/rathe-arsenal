import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { DecisionsService } from '../decisions.service';
import { SubstituteDecisionEntity } from '../../../database/entities/substitute-decision.entity';
import { TrackedDeckEntity } from '../../../database/entities/tracked-deck.entity';

const USER_ID = 'user-uuid-aaa';
const OTHER_USER_ID = 'user-uuid-bbb';
const DECK_ID = 42;
const CARD_A = 'FaB-card-A (1)';
const CARD_B = 'FaB-card-B (1)';

function makeDeck(userId = USER_ID): TrackedDeckEntity {
  return {
    id: DECK_ID,
    userId,
    fabraryUlid: '01H0000000000000000000AAAA',
    name: 'Test Deck',
    hero: 'Bravo',
    format: 'Classic Constructed',
    trackedAt: new Date(),
    user: {} as TrackedDeckEntity['user'],
  };
}

function makeDecisionEntity(
  overrides: Partial<SubstituteDecisionEntity> = {},
): SubstituteDecisionEntity {
  return {
    id: 'decision-uuid-1',
    userId: USER_ID,
    trackedDeckId: DECK_ID,
    cardIdentifier: CARD_A,
    decision: 'rejected',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {} as SubstituteDecisionEntity['user'],
    trackedDeck: {} as SubstituteDecisionEntity['trackedDeck'],
    ...overrides,
  };
}

describe('DecisionsService', () => {
  let service: DecisionsService;
  let decisionRepo: jest.Mocked<Repository<SubstituteDecisionEntity>>;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;

  beforeEach(async () => {
    decisionRepo = createMock<Repository<SubstituteDecisionEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();

    // Default: user owns the deck.
    trackedDeckRepo.findOne.mockResolvedValue(makeDeck());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionsService,
        {
          provide: getRepositoryToken(SubstituteDecisionEntity),
          useValue: decisionRepo,
        },
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
      ],
    }).compile();

    service = module.get<DecisionsService>(DecisionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // assertOwnsDeck
  // -------------------------------------------------------------------------
  describe('assertOwnsDeck', () => {
    it('resolves when the user owns the deck', async () => {
      trackedDeckRepo.findOne.mockResolvedValue(makeDeck());
      await expect(service.assertOwnsDeck(USER_ID, DECK_ID)).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when the deck does not belong to the user', async () => {
      trackedDeckRepo.findOne.mockResolvedValue(null);
      await expect(service.assertOwnsDeck(OTHER_USER_ID, DECK_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns all decisions for the user on the deck', async () => {
      // Arrange
      decisionRepo.find.mockResolvedValue([
        makeDecisionEntity({ decision: 'rejected', cardIdentifier: CARD_A }),
        makeDecisionEntity({ decision: 'approved', cardIdentifier: CARD_B, id: 'decision-uuid-2' }),
      ]);

      // Act
      const result = await service.list(USER_ID, DECK_ID);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ cardIdentifier: CARD_A, decision: 'rejected' });
      expect(result[1]).toEqual({ cardIdentifier: CARD_B, decision: 'approved' });
    });

    it('returns empty array when no decisions exist', async () => {
      decisionRepo.find.mockResolvedValue([]);
      const result = await service.list(USER_ID, DECK_ID);
      expect(result).toEqual([]);
    });

    it('throws ForbiddenException when user does not own the deck', async () => {
      trackedDeckRepo.findOne.mockResolvedValue(null);
      await expect(service.list(OTHER_USER_ID, DECK_ID)).rejects.toThrow(ForbiddenException);
      expect(decisionRepo.find).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // loadExclusions
  // -------------------------------------------------------------------------
  describe('loadExclusions', () => {
    it('returns only rejected card identifiers', async () => {
      // Arrange: one rejected, one approved — only rejected should appear.
      decisionRepo.find.mockResolvedValue([
        makeDecisionEntity({ cardIdentifier: CARD_A, decision: 'rejected' }),
      ]);

      // Act
      const result = await service.loadExclusions(DECK_ID);

      // Assert
      expect(result).toBeInstanceOf(Set);
      expect(result.has(CARD_A)).toBe(true);
      expect(result.size).toBe(1);
      // Query must filter to rejected only.
      expect(decisionRepo.find).toHaveBeenCalledWith({
        where: { trackedDeckId: DECK_ID, decision: 'rejected' },
        select: ['cardIdentifier'],
      });
    });

    it('returns an empty set when no rejections exist', async () => {
      decisionRepo.find.mockResolvedValue([]);
      const result = await service.loadExclusions(DECK_ID);
      expect(result.size).toBe(0);
    });

    it('does NOT include approved decisions in the exclusion set', async () => {
      // Arrange: both approved exist, no rejected.
      decisionRepo.find.mockResolvedValue([]);
      const result = await service.loadExclusions(DECK_ID);
      expect(result.has(CARD_B)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // countRejected
  // -------------------------------------------------------------------------
  describe('countRejected', () => {
    it('returns the count of rejected decisions', async () => {
      decisionRepo.count.mockResolvedValue(3);
      const result = await service.countRejected(DECK_ID);
      expect(result).toBe(3);
      expect(decisionRepo.count).toHaveBeenCalledWith({
        where: { trackedDeckId: DECK_ID, decision: 'rejected' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // upsert
  // -------------------------------------------------------------------------
  describe('upsert', () => {
    it('inserts a new decision when none exists (happy path insert)', async () => {
      // Arrange: no existing row.
      decisionRepo.findOne.mockResolvedValue(null);
      decisionRepo.create.mockReturnValue(
        makeDecisionEntity({ decision: 'approved', cardIdentifier: CARD_A }),
      );
      decisionRepo.save.mockResolvedValue(
        makeDecisionEntity({ decision: 'approved', cardIdentifier: CARD_A }),
      );

      // Act
      const result = await service.upsert({
        userId: USER_ID,
        trackedDeckId: DECK_ID,
        cardIdentifier: CARD_A,
        decision: 'approved',
      });

      // Assert
      expect(decisionRepo.save).toHaveBeenCalledTimes(1);
      expect(decisionRepo.update).not.toHaveBeenCalled();
      expect(result).toEqual({ cardIdentifier: CARD_A, decision: 'approved' });
    });

    it('updates existing row when called again with different decision (insert-then-update semantics)', async () => {
      // Arrange: existing row with 'approved', update to 'rejected'.
      const existingEntity = makeDecisionEntity({ decision: 'approved', cardIdentifier: CARD_A });
      decisionRepo.findOne.mockResolvedValue(existingEntity);
      decisionRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      // Act
      const result = await service.upsert({
        userId: USER_ID,
        trackedDeckId: DECK_ID,
        cardIdentifier: CARD_A,
        decision: 'rejected',
      });

      // Assert
      expect(decisionRepo.update).toHaveBeenCalledWith(
        existingEntity.id,
        expect.objectContaining({ decision: 'rejected' }),
      );
      expect(decisionRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual({ cardIdentifier: CARD_A, decision: 'rejected' });
    });

    it('throws ForbiddenException when user does not own the deck', async () => {
      trackedDeckRepo.findOne.mockResolvedValue(null);
      await expect(
        service.upsert({
          userId: OTHER_USER_ID,
          trackedDeckId: DECK_ID,
          cardIdentifier: CARD_A,
          decision: 'rejected',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(decisionRepo.save).not.toHaveBeenCalled();
      expect(decisionRepo.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // resetOne
  // -------------------------------------------------------------------------
  describe('resetOne', () => {
    it('deletes the decision row (resets to pending)', async () => {
      // Arrange
      decisionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      // Act
      await service.resetOne(USER_ID, DECK_ID, CARD_A);

      // Assert
      expect(decisionRepo.delete).toHaveBeenCalledWith({
        userId: USER_ID,
        trackedDeckId: DECK_ID,
        cardIdentifier: CARD_A,
      });
    });

    it('is idempotent when no row exists (no-op)', async () => {
      decisionRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      await expect(service.resetOne(USER_ID, DECK_ID, CARD_A)).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when user does not own the deck', async () => {
      trackedDeckRepo.findOne.mockResolvedValue(null);
      await expect(service.resetOne(OTHER_USER_ID, DECK_ID, CARD_A)).rejects.toThrow(
        ForbiddenException,
      );
      expect(decisionRepo.delete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // clearRejections
  // -------------------------------------------------------------------------
  describe('clearRejections', () => {
    it('bulk-deletes only rejected decisions and returns the affected count', async () => {
      // Arrange: 2 rejections in DB.
      decisionRepo.delete.mockResolvedValue({ affected: 2, raw: [] });

      // Act
      const count = await service.clearRejections(USER_ID, DECK_ID);

      // Assert: count returned correctly.
      expect(count).toBe(2);
      // Only rejections targeted.
      expect(decisionRepo.delete).toHaveBeenCalledWith({
        userId: USER_ID,
        trackedDeckId: DECK_ID,
        decision: 'rejected',
      });
    });

    it('preserves approved decisions — query filters to rejected only', async () => {
      // The delete call must include decision:'rejected' so approvals survive.
      decisionRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      await service.clearRejections(USER_ID, DECK_ID);
      const deleteArg = (decisionRepo.delete as jest.Mock).mock.calls[0][0] as {
        decision?: string;
      };
      expect(deleteArg.decision).toBe('rejected');
    });

    it('returns 0 when no rejections exist', async () => {
      decisionRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      const count = await service.clearRejections(USER_ID, DECK_ID);
      expect(count).toBe(0);
    });

    it('throws ForbiddenException when user does not own the deck', async () => {
      trackedDeckRepo.findOne.mockResolvedValue(null);
      await expect(service.clearRejections(OTHER_USER_ID, DECK_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(decisionRepo.delete).not.toHaveBeenCalled();
    });
  });
});
