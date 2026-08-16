import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import {
  DecisionsService,
  IBulkReviewOperation,
} from '../decisions.service';
import { SwapSuggestionEntity } from '../../../database/entities/swap-suggestion.entity';
import { TrackedDeckEntity } from '../../../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../../../substitution/substitution.service';
import { SwapSuggestionQueryService } from '../../../swaps/swap-suggestion-query.service';

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
    heroIdentifier: 'bravo-showstopper',
    format: 'Classic Constructed',
    status: 'building',
    trackedAt: new Date(),
    updatedAt: new Date(),
    user: {} as TrackedDeckEntity['user'],
  };
}

describe('DecisionsService (compatibility shim over swap_suggestion)', () => {
  let service: DecisionsService;
  let swapRepo: jest.Mocked<Repository<SwapSuggestionEntity>>;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let dataSource: jest.Mocked<DataSource>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let swapSuggestionQueryService: jest.Mocked<SwapSuggestionQueryService>;

  beforeEach(async () => {
    swapRepo = createMock<Repository<SwapSuggestionEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    dataSource = createMock<DataSource>();
    substitutionService = createMock<SubstitutionService>();
    swapSuggestionQueryService = createMock<SwapSuggestionQueryService>();

    trackedDeckRepo.findOne.mockResolvedValue(makeDeck());
    swapSuggestionQueryService.loadReadinessInputs.mockResolvedValue({
      excludedIdentifiers: new Set(),
      approvedIdentifiers: new Set(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecisionsService,
        { provide: getRepositoryToken(SwapSuggestionEntity), useValue: swapRepo },
        { provide: getRepositoryToken(TrackedDeckEntity), useValue: trackedDeckRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: SwapSuggestionQueryService, useValue: swapSuggestionQueryService },
      ],
    }).compile();

    service = module.get<DecisionsService>(DecisionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

  describe('list', () => {
    it('returns one decision per distinct substitute, deduped from per-quadruple rows', async () => {
      swapRepo.find.mockResolvedValue([
        { substituteIdentifier: CARD_A, status: 'rejected' },
        { substituteIdentifier: CARD_B, status: 'approved' },
      ] as SwapSuggestionEntity[]);

      const result = await service.list(USER_ID, DECK_ID);

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([
          { cardIdentifier: CARD_A, decision: 'rejected' },
          { cardIdentifier: CARD_B, decision: 'approved' },
        ]),
      );
    });

    it('rejected wins the tiebreak when the same substitute backs conflicting-status rows', async () => {
      swapRepo.find.mockResolvedValue([
        { substituteIdentifier: CARD_A, status: 'approved' },
        { substituteIdentifier: CARD_A, status: 'rejected' },
      ] as SwapSuggestionEntity[]);

      const result = await service.list(USER_ID, DECK_ID);

      expect(result).toEqual([{ cardIdentifier: CARD_A, decision: 'rejected' }]);
    });

    it('returns empty array when no decisions exist', async () => {
      swapRepo.find.mockResolvedValue([]);
      const result = await service.list(USER_ID, DECK_ID);
      expect(result).toEqual([]);
    });

    it('throws ForbiddenException when user does not own the deck', async () => {
      trackedDeckRepo.findOne.mockResolvedValue(null);
      await expect(service.list(OTHER_USER_ID, DECK_ID)).rejects.toThrow(ForbiddenException);
      expect(swapRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('countRejected', () => {
    it('returns the count of distinct rejected substitutes', async () => {
      swapRepo.find.mockResolvedValue([
        { substituteIdentifier: CARD_A, status: 'rejected' },
        { substituteIdentifier: CARD_B, status: 'rejected' },
      ] as SwapSuggestionEntity[]);

      const result = await service.countRejected(DECK_ID);
      expect(result).toBe(2);
    });

    it('does not double-count the same substitute rejected in two slots', async () => {
      swapRepo.find.mockResolvedValue([
        { substituteIdentifier: CARD_A, status: 'rejected' },
        { substituteIdentifier: CARD_A, status: 'rejected' },
      ] as SwapSuggestionEntity[]);

      const result = await service.countRejected(DECK_ID);
      expect(result).toBe(1);
    });
  });

  describe('upsert', () => {
    it('broadly updates every matching swap_suggestion row for the substitute', async () => {
      swapRepo.update.mockResolvedValue({ affected: 2, raw: [], generatedMaps: [] });

      const result = await service.upsert({
        userId: USER_ID,
        trackedDeckId: DECK_ID,
        cardIdentifier: CARD_A,
        decision: 'approved',
      });

      expect(swapRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ trackedDeckId: DECK_ID, substituteIdentifier: CARD_A }),
        expect.objectContaining({ status: 'approved' }),
      );
      expect(result).toEqual({ cardIdentifier: CARD_A, decision: 'approved' });
    });

    it('is a no-op write (still returns the decision) when no row matches the substitute', async () => {
      swapRepo.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });

      const result = await service.upsert({
        userId: USER_ID,
        trackedDeckId: DECK_ID,
        cardIdentifier: 'never-proposed',
        decision: 'rejected',
      });

      expect(result).toEqual({ cardIdentifier: 'never-proposed', decision: 'rejected' });
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
      expect(swapRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('resetOne', () => {
    it('flips matching rows back to pending rather than deleting them', async () => {
      swapRepo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });

      await service.resetOne(USER_ID, DECK_ID, CARD_A);

      expect(swapRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ trackedDeckId: DECK_ID, substituteIdentifier: CARD_A }),
        expect.objectContaining({ status: 'pending' }),
      );
      expect(swapRepo.delete).not.toHaveBeenCalled();
    });

    it('is idempotent when no row exists (no-op)', async () => {
      swapRepo.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });
      await expect(service.resetOne(USER_ID, DECK_ID, CARD_A)).resolves.toBeUndefined();
    });

    it('throws ForbiddenException when user does not own the deck', async () => {
      trackedDeckRepo.findOne.mockResolvedValue(null);
      await expect(service.resetOne(OTHER_USER_ID, DECK_ID, CARD_A)).rejects.toThrow(
        ForbiddenException,
      );
      expect(swapRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('clearRejections', () => {
    it('resets only rejected rows to pending and returns the affected count', async () => {
      swapRepo.update.mockResolvedValue({ affected: 2, raw: [], generatedMaps: [] });

      const count = await service.clearRejections(USER_ID, DECK_ID);

      expect(count).toBe(2);
      expect(swapRepo.update).toHaveBeenCalledWith(
        { trackedDeckId: DECK_ID, status: 'rejected' },
        expect.objectContaining({ status: 'pending' }),
      );
      expect(swapRepo.delete).not.toHaveBeenCalled();
    });

    it('returns 0 when no rejections exist', async () => {
      swapRepo.update.mockResolvedValue({ affected: 0, raw: [], generatedMaps: [] });
      const count = await service.clearRejections(USER_ID, DECK_ID);
      expect(count).toBe(0);
    });

    it('throws ForbiddenException when user does not own the deck', async () => {
      trackedDeckRepo.findOne.mockResolvedValue(null);
      await expect(service.clearRejections(OTHER_USER_ID, DECK_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(swapRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpsert', () => {
    function mockTransaction(onCall?: (manager: { getRepository: jest.Mock }) => void) {
      const fakeRepo = {
        update: jest.fn().mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] }),
      };
      const fakeManager = { getRepository: jest.fn().mockReturnValue(fakeRepo) };
      onCall?.(fakeManager);

      (dataSource.transaction as jest.Mock).mockImplementation(
        async (cb: (manager: typeof fakeManager) => Promise<void>) => cb(fakeManager),
      );

      return { fakeRepo, fakeManager };
    }

    function setupOwnedDecks(deckIds: number[]) {
      trackedDeckRepo.find.mockResolvedValue(deckIds.map((id) => makeDeck(USER_ID, id)));
    }

    it('happy path: 10 mixed ops across 3 decks → succeeded=10, failed=[], recompute called 3 times', async () => {
      setupOwnedDecks([DECK_ID, DECK_ID_2, DECK_ID_3]);
      mockTransaction();
      substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card A (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card B (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card C (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card D (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_3, cardIdentifier: 'Card E (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card F (1)', decision: 'REJECTED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card G (1)', decision: 'REJECTED' },
        { trackedDeckId: DECK_ID_3, cardIdentifier: 'Card H (1)', decision: 'REJECTED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card I (1)', reset: true },
        { trackedDeckId: DECK_ID_3, cardIdentifier: 'Card J (1)', reset: true },
      ];

      const result = await service.bulkUpsert(USER_ID, ops);

      expect(result.succeeded).toBe(10);
      expect(result.failed).toHaveLength(0);
      expect(result.transactionError).toBeUndefined();

      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(3);
      const recomputeArgs = (substitutionService.computeAndStoreReadiness as jest.Mock).mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(recomputeArgs).toEqual(expect.arrayContaining([DECK_ID, DECK_ID_2, DECK_ID_3]));
    });

    it('edge: op with a trackedDeckId belonging to another user → NOT_ACCESSIBLE, others succeed', async () => {
      trackedDeckRepo.find.mockResolvedValue([makeDeck(USER_ID, DECK_ID)]);
      mockTransaction();
      substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: CARD_A, decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: CARD_B, decision: 'REJECTED' },
      ];

      const result = await service.bulkUpsert(USER_ID, ops);

      expect(result.succeeded).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toMatchObject({
        trackedDeckId: String(DECK_ID_2),
        cardIdentifier: CARD_B,
        error: 'NOT_ACCESSIBLE',
      });
    });

    it('edge: op with a trackedDeckId that does not exist → NOT_ACCESSIBLE (same opaque error)', async () => {
      trackedDeckRepo.find.mockResolvedValue([]);
      mockTransaction();

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: 9999, cardIdentifier: CARD_A, decision: 'APPROVED' },
      ];

      const result = await service.bulkUpsert(USER_ID, ops);

      expect(result.succeeded).toBe(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]!.error).toBe('NOT_ACCESSIBLE');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('edge: tx-abort on 3rd op → succeeded=0, all validated ops in failed, recompute NOT called', async () => {
      setupOwnedDecks([DECK_ID]);

      let callCount = 0;
      const { fakeRepo } = mockTransaction();
      fakeRepo.update.mockImplementation(async () => {
        callCount++;
        if (callCount === 3) {
          throw new Error('DB error on 3rd op');
        }
        return { affected: 1, raw: [], generatedMaps: [] };
      });

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card A (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card B (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card C (1)', decision: 'REJECTED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card D (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card E (1)', decision: 'REJECTED' },
      ];

      const result = await service.bulkUpsert(USER_ID, ops);

      expect(result.succeeded).toBe(0);
      expect(result.failed).toHaveLength(5);
      expect(result.transactionError).toBeDefined();
      expect(result.transactionError!.cursorHint).toBe(2);
      expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
    });

    it('edge: pre-validation classifies 2 as NOT_ACCESSIBLE, remaining 8 succeed → recompute per affected deck only', async () => {
      trackedDeckRepo.find.mockResolvedValue([makeDeck(USER_ID, DECK_ID)]);
      mockTransaction();
      substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card A (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card B (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card C (1)', decision: 'REJECTED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card D (1)', decision: 'REJECTED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card E (1)', reset: true },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card F (1)', reset: true },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card G (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: 'Card H (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card I (1)', decision: 'APPROVED' },
        { trackedDeckId: DECK_ID_2, cardIdentifier: 'Card J (1)', decision: 'REJECTED' },
      ];

      const result = await service.bulkUpsert(USER_ID, ops);

      expect(result.succeeded).toBe(8);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0]!.error).toBe('NOT_ACCESSIBLE');
      expect(result.failed[1]!.error).toBe('NOT_ACCESSIBLE');

      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledTimes(1);
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        expect.any(Set),
        expect.any(Set),
      );
    });

    it('edge: all-ops are invalid shape (neither decision nor reset) → INVALID_SHAPE, no tx', async () => {
      setupOwnedDecks([DECK_ID]);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: CARD_A } as IBulkReviewOperation,
      ];

      const result = await service.bulkUpsert(USER_ID, ops);

      expect(result.succeeded).toBe(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]!.error).toBe('INVALID_SHAPE');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('recompute failure is non-fatal — succeeded count is still correct', async () => {
      setupOwnedDecks([DECK_ID]);
      mockTransaction();
      substitutionService.computeAndStoreReadiness.mockRejectedValue(new Error('Recompute failed'));

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: CARD_A, decision: 'APPROVED' },
      ];

      const result = await service.bulkUpsert(USER_ID, ops);

      expect(result.succeeded).toBe(1);
      expect(result.failed).toHaveLength(0);
      expect(result.transactionError).toBeUndefined();
    });
  });
});
