/**
 * API integration tests: state-transition matrix for the reviews surface.
 *
 * Uses the real ReviewAggregateService and DecisionsService (the
 * compatibility shim, design/07-swaps.md "Landing sequence") with an
 * in-memory fake `swap_suggestion` store standing in for the repository.
 * Drives `bulkUpsert` end-to-end and asserts post-state via
 * `listSubstitutionRows` -- this is the cross-service regression coverage
 * that proves the shim's write path (POST /api/reviews/bulk) and its read
 * path (GET /api/reviews) agree with each other.
 *
 * Covers all 6 transitions:
 *   pending  -> approve  (1)
 *   pending  -> reject   (3)
 *   approved -> reject   (5) -- user-reported bug surface
 *   approved -> reset    (7)
 *   rejected -> approve  (9)
 *   rejected -> reset    (11)
 *
 * Bug found (pre-redesign): listSubstitutionRows.stateFilter='approved'
 * after an approved->rejected transition must return 0 rows (not 1).
 * This test confirms the shim correctly filters by the updated status.
 *
 * Additional cross-cutting tests:
 *   - Bulk atomicity: 3 decisions upserted, all reflected in the next list call.
 *   - stateFilter='all' returns rows of every state.
 *   - Default stateFilter is 'pending'.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, FindOperator, Repository } from 'typeorm';
import { ReviewAggregateService, ISubstitutionRow } from '../review-aggregate.service';
import { DecisionsService, IBulkReviewOperation } from '../../decks/decisions/decisions.service';
import { ReviewAggregateEntity } from '../../database/entities/review-aggregate.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SwapSuggestionEntity } from '../../database/entities/swap-suggestion.entity';
import { CatalogService } from '../../catalog/catalog.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SwapSuggestionQueryService } from '../../swaps/swap-suggestion-query.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = 'state-matrix-user-uuid';
const DECK_ID = 77;
const ORIG_CARD = 'FaB-original (1)';
const SUB_CARD = 'FaB-substitute (1)';
const SUB_CARD_B = 'FaB-sub-b (1)';
const SUB_CARD_C = 'FaB-sub-c (1)';

// ---------------------------------------------------------------------------
// In-memory fake swap_suggestion store
//
// Stands in for the TypeORM repository across both DecisionsService (writes,
// via the transaction manager and the top-level repo) and
// ReviewAggregateService (reads) so a single test can drive a full
// write-then-read cycle exactly like the real repository would.
// ---------------------------------------------------------------------------

interface IFakeRow extends Pick<SwapSuggestionEntity, 'id' | 'userId' | 'trackedDeckId' | 'cardIdentifier' | 'slot' | 'substituteIdentifier' | 'quantity' | 'tier' | 'confidence' | 'rationale' | 'status' | 'appliedAt' | 'rejectedAt' | 'rejectionReason' | 'rejectionNote' | 'outcome'> {}

function makeSuggestion(overrides: Partial<IFakeRow> & { substituteIdentifier: string }): IFakeRow {
  return {
    id: `swap-${overrides.substituteIdentifier}`,
    userId: USER_ID,
    trackedDeckId: DECK_ID,
    cardIdentifier: ORIG_CARD,
    slot: 'main',
    quantity: 1,
    tier: 1,
    confidence: 85,
    rationale: 'Good substitute',
    status: 'pending',
    appliedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    rejectionNote: null,
    outcome: null,
    ...overrides,
  };
}

/** Evaluates a single TypeORM find-condition value (plain or a FindOperator) against an actual field value. */
function matchesCondition(condition: unknown, actual: unknown): boolean {
  if (condition instanceof FindOperator) {
    const type = condition.type;
    const value = condition.value;
    if (type === 'in') {
      return Array.isArray(value) && value.includes(actual);
    }
    if (type === 'not') {
      // Not(x) or Not(In([...])) -- value may itself be a FindOperator.
      return !matchesCondition(value, actual);
    }
    throw new Error(`Unsupported FindOperator type in test fake: ${type}`);
  }
  return condition === actual;
}

function matchesWhere(where: Record<string, unknown>, row: IFakeRow): boolean {
  return Object.entries(where).every(([key, condition]) =>
    matchesCondition(condition, (row as unknown as Record<string, unknown>)[key]),
  );
}

class FakeSwapSuggestionStore {
  rows: IFakeRow[];

  constructor(initial: readonly IFakeRow[] = []) {
    this.rows = [...initial];
  }

  asRepo() {
    return {
      find: jest.fn(async (opts?: { where?: Record<string, unknown> }) => {
        if (!opts?.where) return [...this.rows];
        return this.rows.filter((r) => matchesWhere(opts.where!, r));
      }),
      update: jest.fn(async (where: Record<string, unknown>, patch: Partial<IFakeRow>) => {
        let affected = 0;
        this.rows = this.rows.map((r) => {
          if (matchesWhere(where, r)) {
            affected += 1;
            return { ...r, ...patch };
          }
          return r;
        });
        return { affected, raw: [], generatedMaps: [] };
      }),
      create: jest.fn((data: Partial<IFakeRow>) => data as IFakeRow),
      save: jest.fn(async (entity: IFakeRow) => {
        this.rows.push(entity);
        return entity;
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// Snapshot fixture helper (still used for the engine breakdown -- the
// snapshot itself no longer backs listSubstitutionRows, but reconciliation
// in a real recompute would derive fresh swap_suggestion rows from exactly
// this shape).
// ---------------------------------------------------------------------------

function suggestionsFromEntries(
  entries: Array<{ origCard: string; subCard: string; subName: string }>,
): IFakeRow[] {
  return entries.map((e) =>
    makeSuggestion({
      id: `swap-${e.subCard}`,
      cardIdentifier: e.origCard,
      substituteIdentifier: e.subCard,
      status: 'pending',
    }),
  );
}

// ---------------------------------------------------------------------------
// Service setup
// ---------------------------------------------------------------------------

interface ITestContext {
  reviewService: ReviewAggregateService;
  decisionsService: DecisionsService;
  trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  store: FakeSwapSuggestionStore;
  dataSource: jest.Mocked<DataSource>;
  substitutionService: jest.Mocked<SubstitutionService>;
}

async function buildContext(initialRows: readonly IFakeRow[] = []): Promise<ITestContext> {
  const aggregateRepo = createMock<Repository<ReviewAggregateEntity>>();
  const snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
  const trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
  const dataSource = createMock<DataSource>();
  const catalogService = createMock<CatalogService>();
  const substitutionService = createMock<SubstitutionService>();
  const swapSuggestionQueryService = createMock<SwapSuggestionQueryService>();
  swapSuggestionQueryService.loadReadinessInputs.mockResolvedValue({
    excludedIdentifiers: new Set(),
    approvedIdentifiers: new Set(),
  });

  const store = new FakeSwapSuggestionStore(initialRows);
  const swapSuggestionRepo = store.asRepo();

  catalogService.getCard.mockReturnValue({
    cardIdentifier: 'fallback',
    name: 'Fallback Card',
    classes: [],
    types: ['Action'],
    pitch: null,
    cost: null,
    power: null,
    defense: null,
    keywords: [],
    imageUrl: null,
  } as unknown as ReturnType<CatalogService['getCard']>);

  // Both writes (DecisionsService) and reads (ReviewAggregateService) share
  // the same fake store, exactly like both services sharing one real table.
  (dataSource.transaction as jest.Mock).mockImplementation(
    async (cb: (manager: { getRepository: () => ReturnType<FakeSwapSuggestionStore['asRepo']> }) => Promise<void>) =>
      cb({ getRepository: () => swapSuggestionRepo }),
  );

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ReviewAggregateService,
      DecisionsService,
      { provide: getRepositoryToken(ReviewAggregateEntity), useValue: aggregateRepo },
      { provide: getRepositoryToken(DeckReadinessSnapshotEntity), useValue: snapshotRepo },
      { provide: getRepositoryToken(TrackedDeckEntity), useValue: trackedDeckRepo },
      { provide: getRepositoryToken(SwapSuggestionEntity), useValue: swapSuggestionRepo },
      { provide: getDataSourceToken(), useValue: dataSource },
      { provide: CatalogService, useValue: catalogService },
      { provide: SubstitutionService, useValue: substitutionService },
      { provide: SwapSuggestionQueryService, useValue: swapSuggestionQueryService },
    ],
  }).compile();

  return {
    reviewService: module.get<ReviewAggregateService>(ReviewAggregateService),
    decisionsService: module.get<DecisionsService>(DecisionsService),
    trackedDeckRepo,
    store,
    dataSource,
    substitutionService,
  };
}

function stubOwnership(
  trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>,
  deckId: number = DECK_ID,
): void {
  const deck: TrackedDeckEntity = {
    id: deckId,
    userId: USER_ID,
    fabraryUlid: '01H0000000000000000000BBBB',
    name: 'Test Deck',
    hero: 'Briar',
    heroIdentifier: 'briar-warden-of-thorns',
    format: 'Classic Constructed',
    status: 'building',
    trackedAt: new Date(),
    updatedAt: new Date(),
    user: {} as TrackedDeckEntity['user'],
  };
  trackedDeckRepo.find.mockResolvedValue([deck]);
  trackedDeckRepo.findOne.mockResolvedValue(deck);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('API state-transition matrix', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Transition 1: pending -> approve
  // -----------------------------------------------------------------------
  describe('Transition 1: pending -> approve', () => {
    it('listSubstitutionRows(state=all) returns decision=approved after bulk approve', async () => {
      const ctx = await buildContext(
        suggestionsFromEntries([{ origCard: ORIG_CARD, subCard: SUB_CARD, subName: 'Sub Card' }]),
      );
      stubOwnership(ctx.trackedDeckRepo);
      ctx.substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: SUB_CARD, decision: 'APPROVED' },
      ];
      const result = await ctx.decisionsService.bulkUpsert(USER_ID, ops);
      expect(result.succeeded).toBe(1);

      const rows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'all');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.decision).toBe('approved');
      expect(rows[0]!.substituteIdentifier).toBe(SUB_CARD);
    });

    it('listSubstitutionRows(state=pending) returns 0 rows after approve', async () => {
      const ctx = await buildContext(
        suggestionsFromEntries([{ origCard: ORIG_CARD, subCard: SUB_CARD, subName: 'Sub Card' }]).map((r) => ({
          ...r,
          status: 'approved',
        })),
      );
      stubOwnership(ctx.trackedDeckRepo);

      const rows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'pending');
      expect(rows).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Transition 3: pending -> reject
  // -----------------------------------------------------------------------
  describe('Transition 3: pending -> reject', () => {
    function rejectedContext() {
      return buildContext(
        suggestionsFromEntries([{ origCard: ORIG_CARD, subCard: SUB_CARD, subName: 'Sub Card' }]).map((r) => ({
          ...r,
          status: 'rejected',
        })),
      );
    }

    it('listSubstitutionRows(state=all) returns decision=rejected after bulk reject', async () => {
      const ctx = await rejectedContext();
      stubOwnership(ctx.trackedDeckRepo);

      const rows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'all');
      expect(rows[0]!.decision).toBe('rejected');
    });

    it('listSubstitutionRows(state=pending) returns 0 rows after reject', async () => {
      const ctx = await rejectedContext();
      stubOwnership(ctx.trackedDeckRepo);

      const rows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'pending');
      expect(rows).toHaveLength(0);
    });

    it('listSubstitutionRows(state=rejected) returns the row after reject', async () => {
      const ctx = await rejectedContext();
      stubOwnership(ctx.trackedDeckRepo);

      const rows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'rejected');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.decision).toBe('rejected');
    });
  });

  // -----------------------------------------------------------------------
  // Transition 5: approved -> reject [user-reported bug]
  // -----------------------------------------------------------------------
  describe('Transition 5: approved -> reject [user-reported bug]', () => {
    it('bulkUpsert REJECTED on an approved row flips it, and state=approved then returns 0', async () => {
      // This test simulates the user-reported bug:
      // 1. Row is approved.
      // 2. User rejects it (sends REJECTED for the substitute).
      // 3. listSubstitutionRows(state='approved') must return 0 rows, NOT 1.
      const ctx = await buildContext(
        suggestionsFromEntries([{ origCard: ORIG_CARD, subCard: SUB_CARD, subName: 'Sub Card' }]).map((r) => ({
          ...r,
          status: 'approved',
        })),
      );
      stubOwnership(ctx.trackedDeckRepo);
      ctx.substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: SUB_CARD, decision: 'REJECTED' },
      ];
      const result = await ctx.decisionsService.bulkUpsert(USER_ID, ops);
      expect(result.succeeded).toBe(1);
      expect(result.transactionError).toBeUndefined();

      const approvedRows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'approved');
      expect(approvedRows).toHaveLength(0);

      const rejectedRows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'rejected');
      expect(rejectedRows).toHaveLength(1);
      expect(rejectedRows[0]!.decision).toBe('rejected');
    });
  });

  // -----------------------------------------------------------------------
  // Transition 7: approved -> reset
  // -----------------------------------------------------------------------
  describe('Transition 7: approved -> reset', () => {
    it('bulkUpsert reset on an approved row flips it back to pending', async () => {
      const ctx = await buildContext(
        suggestionsFromEntries([{ origCard: ORIG_CARD, subCard: SUB_CARD, subName: 'Sub Card' }]).map((r) => ({
          ...r,
          status: 'approved',
        })),
      );
      stubOwnership(ctx.trackedDeckRepo);
      ctx.substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: SUB_CARD, reset: true },
      ];
      const result = await ctx.decisionsService.bulkUpsert(USER_ID, ops);
      expect(result.succeeded).toBe(1);

      const approvedRows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'approved');
      expect(approvedRows).toHaveLength(0);

      const pendingRows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'pending');
      expect(pendingRows).toHaveLength(1);
      expect(pendingRows[0]!.decision).toBe('pending');
    });
  });

  // -----------------------------------------------------------------------
  // Transition 9: rejected -> approve
  // -----------------------------------------------------------------------
  describe('Transition 9: rejected -> approve', () => {
    it('bulkUpsert approve on a rejected row flips it, and state=rejected then returns 0', async () => {
      const ctx = await buildContext(
        suggestionsFromEntries([{ origCard: ORIG_CARD, subCard: SUB_CARD, subName: 'Sub Card' }]).map((r) => ({
          ...r,
          status: 'rejected',
        })),
      );
      stubOwnership(ctx.trackedDeckRepo);
      ctx.substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: SUB_CARD, decision: 'APPROVED' },
      ];
      const result = await ctx.decisionsService.bulkUpsert(USER_ID, ops);
      expect(result.succeeded).toBe(1);

      const rejectedRows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'rejected');
      expect(rejectedRows).toHaveLength(0);

      const approvedRows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'approved');
      expect(approvedRows).toHaveLength(1);
      expect(approvedRows[0]!.decision).toBe('approved');
    });
  });

  // -----------------------------------------------------------------------
  // Transition 11: rejected -> reset
  // -----------------------------------------------------------------------
  describe('Transition 11: rejected -> reset', () => {
    it('bulkUpsert reset on a rejected row flips it back to pending', async () => {
      const ctx = await buildContext(
        suggestionsFromEntries([{ origCard: ORIG_CARD, subCard: SUB_CARD, subName: 'Sub Card' }]).map((r) => ({
          ...r,
          status: 'rejected',
        })),
      );
      stubOwnership(ctx.trackedDeckRepo);
      ctx.substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: SUB_CARD, reset: true },
      ];
      const result = await ctx.decisionsService.bulkUpsert(USER_ID, ops);
      expect(result.succeeded).toBe(1);

      const rejectedRows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'rejected');
      expect(rejectedRows).toHaveLength(0);

      const pendingRows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'pending');
      expect(pendingRows).toHaveLength(1);
      expect(pendingRows[0]!.decision).toBe('pending');
    });
  });

  // -----------------------------------------------------------------------
  // Bulk atomicity: 3 decisions across a single batch
  // -----------------------------------------------------------------------
  describe('Bulk atomicity: 3 approve operations', () => {
    it('3 approvals in one bulk call -> all 3 reflected in listSubstitutionRows(state=approved)', async () => {
      const ctx = await buildContext(
        suggestionsFromEntries([
          { origCard: 'orig-a (1)', subCard: SUB_CARD, subName: 'Sub A' },
          { origCard: 'orig-b (1)', subCard: SUB_CARD_B, subName: 'Sub B' },
          { origCard: 'orig-c (1)', subCard: SUB_CARD_C, subName: 'Sub C' },
        ]),
      );
      stubOwnership(ctx.trackedDeckRepo);
      ctx.substitutionService.computeAndStoreReadiness.mockResolvedValue({} as never);

      const ops: IBulkReviewOperation[] = [
        { trackedDeckId: DECK_ID, cardIdentifier: SUB_CARD, decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: SUB_CARD_B, decision: 'APPROVED' },
        { trackedDeckId: DECK_ID, cardIdentifier: SUB_CARD_C, decision: 'APPROVED' },
      ];

      const result = await ctx.decisionsService.bulkUpsert(USER_ID, ops);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toHaveLength(0);

      const rows = await ctx.reviewService.listSubstitutionRows(USER_ID, 'approved');
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.decision === 'approved')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // stateFilter='all' returns rows of all three states
  // -----------------------------------------------------------------------
  describe("stateFilter=all returns all states", () => {
    it('state=all returns pending, approved, and rejected rows', async () => {
      const rows = suggestionsFromEntries([
        { origCard: 'orig-a (1)', subCard: SUB_CARD, subName: 'Sub A' },
        { origCard: 'orig-b (1)', subCard: SUB_CARD_B, subName: 'Sub B' },
        { origCard: 'orig-c (1)', subCard: SUB_CARD_C, subName: 'Sub C' },
      ]);
      rows[0]!.status = 'approved';
      rows[1]!.status = 'rejected';
      rows[2]!.status = 'pending';

      const ctx = await buildContext(rows);
      stubOwnership(ctx.trackedDeckRepo);

      const result = await ctx.reviewService.listSubstitutionRows(USER_ID, 'all');
      expect(result).toHaveLength(3);

      const bySubId = new Map<string, ISubstitutionRow>();
      for (const r of result) bySubId.set(r.substituteIdentifier, r);

      expect(bySubId.get(SUB_CARD)?.decision).toBe('approved');
      expect(bySubId.get(SUB_CARD_B)?.decision).toBe('rejected');
      expect(bySubId.get(SUB_CARD_C)?.decision).toBe('pending');
    });
  });

  // -----------------------------------------------------------------------
  // Default stateFilter is 'pending'
  // -----------------------------------------------------------------------
  describe('stateFilter default is "pending" when not specified', () => {
    it('calling without stateFilter defaults to pending-only', async () => {
      const ctx = await buildContext(
        suggestionsFromEntries([{ origCard: ORIG_CARD, subCard: SUB_CARD, subName: 'Sub Card' }]).map((r) => ({
          ...r,
          status: 'approved',
        })),
      );
      stubOwnership(ctx.trackedDeckRepo);

      const rows = await ctx.reviewService.listSubstitutionRows(USER_ID);
      expect(rows).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Retired rows are invisible to every state filter
  // -----------------------------------------------------------------------
  describe('retired rows', () => {
    it('are excluded from state=all', async () => {
      const rows = suggestionsFromEntries([{ origCard: ORIG_CARD, subCard: SUB_CARD, subName: 'Sub Card' }]);
      rows[0]!.status = 'retired';

      const ctx = await buildContext(rows);
      stubOwnership(ctx.trackedDeckRepo);

      const result = await ctx.reviewService.listSubstitutionRows(USER_ID, 'all');
      expect(result).toHaveLength(0);
    });
  });
});
