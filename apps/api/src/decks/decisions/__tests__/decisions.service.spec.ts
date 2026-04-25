import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import {
  DecisionsService,
  IBulkReviewOperation,
} from '../decisions.service';
import { SubstituteDecisionEntity } from '../../../database/entities/substitute-decision.entity';
import { TrackedDeckEntity } from '../../../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../../../substitution/substitution.service';

const USER_ID = 'user-uuid-aaa';
const OTHER_USER_ID = 'user-uuid-bbb';
const DECK_ID = 42;
const DECK_ID_2 = 43;
const DECK_ID_3 = 44;
const CARD_A = 'FaB-card-A (1)';
const CARD_B = 'FaB-card-B (1)';

function makeDeck(userId = USER_ID, id = DECK_ID): TrackedDeckEntity {
  return {
    id,
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
  let dataSource: jest.Mocked<DataSource>;
  let substitutionService: jest.Mocked<SubstitutionService>;

  beforeEach(async () => {
    decisionRepo = createMock<Repository<SubstituteDecisionEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    dataSource = createMock<DataSource>();
    substitutionService = createMock<SubstitutionService>();

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
        {
          provide: getDataSourceToken(),
          useValue: dataSource,
        },
        {
          provide: SubstitutionService,
          useValue: substitutionService,
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

  // -------------------------------------------------------------------------
  // bulkUpsert
  // -------------------------------------------------------------------------
  describe('bulkUpsert', () => {
    /**
     * Helper that sets up the DataSource.transaction mock to run the callback
     * synchronously with a fake EntityManager.
     */
    function mockTransaction(
      onCall?: (manager: { getRepository: jest.Mock }) => void,
    ) {
      const fakeRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] }),
        create: jest.fn().mockImplementation((data: Partial<SubstituteDecisionEntity>) => data),
        save: jest.fn().mockImplementation(async (entity: Partial<SubstituteDecisionEntity>) => entity),
        delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] }),
      };
      const fakeManager = {
        getRepository: jest.fn().mockReturnValue(fakeRepo),
      };

      onCall?.(fakeManager);

      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: (manager: typeof fakeManager) => Promise<void>) => {
          return cb(fakeManager);
        },
      );

      return { fakeRepo, fakeManager };
    }

    function setupOwnedDecks(deckIds: number[]) {
      trackedDeckRepo.find.mockResolvedValue(
        deckIds.map((id) => makeDeck(USER_ID, id)),
      );
    }

    it('happy path: 10 mixed ops across 3 decks → succeeded=10, failed=[], recompute called 3 times', async () => {
      // Arrange
      setupOwnedDecks([DECK_ID, DECK_ID_2, DECK_ID_3]);
      mockTransaction();
      decisionRepo.find.mockResolvedValue([]); // loadExclusions returns empty set
      substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        // 5 approvals across 3 decks
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card A (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card B (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card C (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card D (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_3, cardIdentifier: 'Card E (1)', decision: 'APPROVED' },
        // 3 rejections
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card F (1)', decision: 'REJECTED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card G (1)', decision: 'REJECTED' },
        { trackedDeckId: DECK_ID_3, cardIdentifier: 'Card H (1)', decision: 'REJECTED' },
        // 2 resets
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card I (1)', reset: true },
        { trackedDeckId: DECK_ID_3, cardIdentifier: 'Card J (1)', reset: true },
      ];

      // Act
      const result = await service.bulkUpsert(USER_ID, ops);

      // Assert
      expect(result.succeeded).toBe(10);
      expect(result.failed).toHaveLength(0);
      expect(result.transactionError).toBeUndefined();

      // Recompute called once per deck (3 decks), not once per op.
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(3);
      const recomputeArgs = (substitutionService.computeAndStoreReadiness as jest.Mock).mock.calls
        .map((call: unknown[]) => call[0]);
      expect(recomputeArgs).toEqual(expect.arrayContaining([DECK_ID, DECK_ID_2, DECK_ID_3]));
    });

    it('edge: op with a trackedDeckId belonging to another user → NOT_ACCESSIBLE, others succeed', async () => {
      // Arrange: only DECK_ID is owned; DECK_ID_2 belongs to another user.
      trackedDeckRepo.find.mockResolvedValue([makeDeck(USER_ID, DECK_ID)]);
      mockTransaction();
      decisionRepo.find.mockResolvedValue([]);
      substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: CARD_A, decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: CARD_B, decision: 'REJECTED' }, // foreign deck
      ];

      // Act
      const result = await service.bulkUpsert(USER_ID, ops);

      // Assert
      expect(result.succeeded).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toMatchObject({
        trackedDeckId: String(DECK_ID_2),
        cardIdentifier: CARD_B,
        error: 'NOT_ACCESSIBLE',
      });
    });

    it('edge: op with a trackedDeckId that does not exist → NOT_ACCESSIBLE (same opaque error)', async () => {
      // Arrange: no deck found at all.
      trackedDeckRepo.find.mockResolvedValue([]);
      mockTransaction();

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: 9999, cardIdentifier: CARD_A, decision: 'APPROVED' },
      ];

      // Act
      const result = await service.bulkUpsert(USER_ID, ops);

      // Assert: same opaque NOT_ACCESSIBLE error for non-existent deck.
      expect(result.succeeded).toBe(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]!.error).toBe('NOT_ACCESSIBLE');
      // Transaction should not have been called.
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('edge: tx-abort on 3rd op → succeeded=0, all validated ops in failed, recompute NOT called', async () => {
      // Arrange: 5 ops, all on owned deck; 3rd insert throws.
      setupOwnedDecks([DECK_ID]);

      let callCount = 0;
      const { fakeRepo } = mockTransaction();
      fakeRepo.findOne.mockResolvedValue(null);
      fakeRepo.save.mockImplementation(async () => {
        callCount++;
        if (callCount === 3) {
          throw new Error('DB error on 3rd op');
        }
        return {};
      });

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card A (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card B (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card C (1)', decision: 'REJECTED' }, // aborts here
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card D (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card E (1)', decision: 'REJECTED' },
      ];

      // Act
      const result = await service.bulkUpsert(USER_ID, ops);

      // Assert
      expect(result.succeeded).toBe(0);
      expect(result.failed).toHaveLength(5);
      expect(result.transactionError).toBeDefined();
      expect(result.transactionError!.cursorHint).toBe(2); // 0-indexed 3rd op
      // Non-fatal recompute must NOT be called when tx aborts.
      expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
    });

    it('edge: pre-validation classifies 2 as NOT_ACCESSIBLE, remaining 8 succeed → recompute per affected deck only', async () => {
      // Arrange: DECK_ID owned; DECK_ID_2 not owned.
      trackedDeckRepo.find.mockResolvedValue([makeDeck(USER_ID, DECK_ID)]);
      mockTransaction();
      decisionRepo.find.mockResolvedValue([]);
      substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        // 8 valid ops on DECK_ID
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card A (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card B (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card C (1)', decision: 'REJECTED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card D (1)', decision: 'REJECTED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card E (1)', reset: true },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card F (1)', reset: true },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card G (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card H (1)', decision: 'APPROVED' },
        // 2 inaccessible ops on DECK_ID_2
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card I (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card J (1)', decision: 'REJECTED' },
      ];

      // Act
      const result = await service.bulkUpsert(USER_ID, ops);

      // Assert
      expect(result.succeeded).toBe(8);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0]!.error).toBe('NOT_ACCESSIBLE');
      expect(result.failed[1]!.error).toBe('NOT_ACCESSIBLE');

      // Recompute only for DECK_ID (the deck with validated ops), not DECK_ID_2.
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(1);
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.any(Set),
      );
    });

    it('edge: all-ops are invalid shape (neither decision nor reset) → INVALID_SHAPE, no tx', async () => {
      // Arrange: deck is owned but ops have no decision or reset.
      setupOwnedDecks([DECK_ID]);

      const ops: IBulkReviewOperation[] = [
        // Simulate post-DTO ops with neither decision nor reset (safety-net path).
        { trackedDeckId: DECK_ID, cardIdentifier: CARD_A } as IBulkReviewOperation,
      ];

      // Act
      const result = await service.bulkUpsert(USER_ID, ops);

      // Assert
      expect(result.succeeded).toBe(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]!.error).toBe('INVALID_SHAPE');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('recompute failure is non-fatal — succeeded count is still correct', async () => {
      // Arrange: valid ops, but recompute throws.
      setupOwnedDecks([DECK_ID]);
      mockTransaction();
      decisionRepo.find.mockResolvedValue([]);
      substitutionService.computeAndStoreReadiness.mockRejectedValue(
        new Error('Recompute failed'),
      );

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: CARD_A, decision: 'APPROVED' },
      ];

      // Act — should not throw even when recompute fails.
      const result = await service.bulkUpsert(USER_ID, ops);

      // Assert: the committed result is still returned correctly.
      expect(result.succeeded).toBe(1);
      expect(result.failed).toHaveLength(0);
      expect(result.transactionError).toBeUndefined();
    });
  });
});
