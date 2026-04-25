import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { ReviewAggregateService } from '../review-aggregate.service';
import { ReviewAggregateEntity } from '../../database/entities/review-aggregate.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SubstituteDecisionEntity } from '../../database/entities/substitute-decision.entity';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const USER_A = 'user-uuid-aaaa';
const USER_B = 'user-uuid-bbbb';
const DECK_ID = 10;
const DECK_ID_2 = 11;

/**
 * Snapshot with Path A (all exact, no substituted, no missing).
 * Verdict: 'ready_to_play', bracket: 'A'.
 */
function makeSnapshotPathA(
  trackedDeckId: number = DECK_ID,
): DeckReadinessSnapshotEntity {
  return {
    id: 1,
    trackedDeckId,
    rawPercent: 100,
    effectivePercent: 100,
    breakdown: {
      exact: [{ cardIdentifier: 'FaB-A (1)', quantity: 1, slot: 'main', pitch: 1, cost: 2, type: 'Action', imageUrl: null }],
      substituted: [],
      missing: [],
      notOwned: [],
    } as unknown as Record<string, unknown>,
    substitutions: {} as Record<string, unknown>,
    computedAt: new Date(),
    trackedDeck: {} as DeckReadinessSnapshotEntity['trackedDeck'],
  };
}

/**
 * Snapshot with Path B (some substituted, no missing).
 * Verdict: 'close', bracket: 'B'.
 */
function makeSnapshotPathB(
  trackedDeckId: number = DECK_ID,
): DeckReadinessSnapshotEntity {
  return {
    id: 2,
    trackedDeckId,
    rawPercent: 80,
    effectivePercent: 100,
    breakdown: {
      exact: [{ cardIdentifier: 'FaB-A (1)', quantity: 1, slot: 'main', pitch: 1, cost: 2, type: 'Action', imageUrl: null }],
      substituted: [
        {
          original: { cardIdentifier: 'FaB-B (1)', quantity: 1, slot: 'main', pitch: 2, cost: 0, type: 'Action', imageUrl: null },
          match: { cardIdentifier: 'FaB-C (1)', tier: 1, confidence: 0.9, rationale: 'close-match', quantity: 1 },
        },
      ],
      missing: [],
      notOwned: [],
    } as unknown as Record<string, unknown>,
    substitutions: {} as Record<string, unknown>,
    computedAt: new Date(),
    trackedDeck: {} as DeckReadinessSnapshotEntity['trackedDeck'],
  };
}

/**
 * Snapshot with Path C (some missing cards).
 * Verdict: 'not_ready', bracket: 'C'.
 */
function makeSnapshotPathC(
  trackedDeckId: number = DECK_ID,
): DeckReadinessSnapshotEntity {
  return {
    id: 3,
    trackedDeckId,
    rawPercent: 60,
    effectivePercent: 70,
    breakdown: {
      exact: [{ cardIdentifier: 'FaB-A (1)', quantity: 1, slot: 'main', pitch: 1, cost: 2, type: 'Action', imageUrl: null }],
      substituted: [],
      missing: [
        { cardIdentifier: 'FaB-D (1)', quantity: 2, slot: 'main', pitch: 3, cost: 1, type: 'Action', imageUrl: null },
      ],
      notOwned: [],
    } as unknown as Record<string, unknown>,
    substitutions: {} as Record<string, unknown>,
    computedAt: new Date(),
    trackedDeck: {} as DeckReadinessSnapshotEntity['trackedDeck'],
  };
}

function makeAggregateEntity(
  overrides: Partial<ReviewAggregateEntity> = {},
): ReviewAggregateEntity {
  return {
    id: 'agg-uuid-1',
    userId: USER_A,
    deckId: DECK_ID,
    status: 'ready',
    lastComputedAt: new Date(),
    verdict: 'ready_to_play',
    counters: { have: 1, missing: 0, partial: 0 },
    bracket: 'A',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {} as ReviewAggregateEntity['user'],
    deck: {} as ReviewAggregateEntity['deck'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ReviewAggregateService', () => {
  let service: ReviewAggregateService;
  let aggregateRepo: jest.Mocked<Repository<ReviewAggregateEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;

  beforeEach(async () => {
    aggregateRepo = createMock<Repository<ReviewAggregateEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    const trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    const decisionRepo = createMock<Repository<SubstituteDecisionEntity>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewAggregateService,
        {
          provide: getRepositoryToken(ReviewAggregateEntity),
          useValue: aggregateRepo,
        },
        {
          provide: getRepositoryToken(DeckReadinessSnapshotEntity),
          useValue: snapshotRepo,
        },
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
        {
          provide: getRepositoryToken(SubstituteDecisionEntity),
          useValue: decisionRepo,
        },
      ],
    }).compile();

    service = module.get<ReviewAggregateService>(ReviewAggregateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // computeForDeck
  // -------------------------------------------------------------------------

  describe('computeForDeck', () => {
    it('writes a row with verdict=ready_to_play + bracket=A given a Path A snapshot', async () => {
      // Arrange
      const snapshot = makeSnapshotPathA();
      snapshotRepo.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(snapshot),
      });
      aggregateRepo.findOne.mockResolvedValue(null);
      const savedEntity = makeAggregateEntity();
      aggregateRepo.create.mockReturnValue(savedEntity);
      aggregateRepo.save.mockResolvedValue(savedEntity);

      // Act
      const result = await service.computeForDeck(USER_A, DECK_ID);

      // Assert
      expect(aggregateRepo.save).toHaveBeenCalledTimes(1);
      const savedArg = (aggregateRepo.save as jest.Mock).mock.calls[0][0] as ReviewAggregateEntity;
      expect(savedArg.verdict).toBe('ready_to_play');
      expect(savedArg.bracket).toBe('A');
      expect(savedArg.counters).toEqual({ have: 1, missing: 0, partial: 0 });
      expect(savedArg.status).toBe('ready');
      expect(result).not.toBeNull();
      expect(result!.verdict).toBe('ready_to_play');
      expect(result!.bracket).toBe('A');
    });

    it('writes verdict=close + bracket=B given a Path B snapshot', async () => {
      // Arrange
      const snapshot = makeSnapshotPathB();
      snapshotRepo.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(snapshot),
      });
      aggregateRepo.findOne.mockResolvedValue(null);
      const savedEntity = makeAggregateEntity({
        verdict: 'close',
        bracket: 'B',
        counters: { have: 1, missing: 0, partial: 1 },
      });
      aggregateRepo.create.mockReturnValue(savedEntity);
      aggregateRepo.save.mockResolvedValue(savedEntity);

      // Act
      const result = await service.computeForDeck(USER_A, DECK_ID);

      // Assert
      const savedArg = (aggregateRepo.save as jest.Mock).mock.calls[0][0] as ReviewAggregateEntity;
      expect(savedArg.verdict).toBe('close');
      expect(savedArg.bracket).toBe('B');
      expect(savedArg.counters).toEqual({ have: 1, missing: 0, partial: 1 });
      expect(result).not.toBeNull();
      expect(result!.verdict).toBe('close');
    });

    it('writes verdict=not_ready + bracket=C given a Path C snapshot', async () => {
      // Arrange
      const snapshot = makeSnapshotPathC();
      snapshotRepo.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(snapshot),
      });
      aggregateRepo.findOne.mockResolvedValue(null);
      const savedEntity = makeAggregateEntity({
        verdict: 'not_ready',
        bracket: 'C',
        counters: { have: 1, missing: 1, partial: 0 },
      });
      aggregateRepo.create.mockReturnValue(savedEntity);
      aggregateRepo.save.mockResolvedValue(savedEntity);

      // Act
      const result = await service.computeForDeck(USER_A, DECK_ID);

      // Assert
      const savedArg = (aggregateRepo.save as jest.Mock).mock.calls[0][0] as ReviewAggregateEntity;
      expect(savedArg.verdict).toBe('not_ready');
      expect(savedArg.bracket).toBe('C');
      expect(savedArg.counters).toEqual({ have: 1, missing: 1, partial: 0 });
      expect(result).not.toBeNull();
      expect(result!.verdict).toBe('not_ready');
    });

    it('is idempotent: second call updates the existing row, does not insert a new one', async () => {
      // Arrange
      const snapshot = makeSnapshotPathA();
      snapshotRepo.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(snapshot),
      });

      const existing = makeAggregateEntity({ status: 'stale' });
      aggregateRepo.findOne.mockResolvedValue(existing);
      aggregateRepo.save.mockResolvedValue({ ...existing, status: 'ready' });

      // Act — call twice
      await service.computeForDeck(USER_A, DECK_ID);
      await service.computeForDeck(USER_A, DECK_ID);

      // Assert — create should never be called (existing row is reused).
      expect(aggregateRepo.create).not.toHaveBeenCalled();
      // save is called once per invocation, updating the same entity.
      expect(aggregateRepo.save).toHaveBeenCalledTimes(2);
      const [firstCall] = (aggregateRepo.save as jest.Mock).mock.calls;
      expect(firstCall[0]).toMatchObject({ id: 'agg-uuid-1' });
    });

    it('returns null when no snapshot exists for the deck', async () => {
      // Arrange
      snapshotRepo.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      // Act
      const result = await service.computeForDeck(USER_A, DECK_ID);

      // Assert — no write should happen when there is no snapshot.
      expect(aggregateRepo.save).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getForUser
  // -------------------------------------------------------------------------

  describe('getForUser', () => {
    it('returns all aggregate rows for the user', async () => {
      // Arrange
      const rows = [
        makeAggregateEntity({ deckId: DECK_ID }),
        makeAggregateEntity({ id: 'agg-uuid-2', deckId: DECK_ID_2 }),
      ];
      aggregateRepo.find.mockResolvedValue(rows);

      // Act
      const result = await service.getForUser(USER_A);

      // Assert
      expect(aggregateRepo.find).toHaveBeenCalledWith({
        where: { userId: USER_A },
      });
      expect(result).toHaveLength(2);
    });

    it('returns an empty array when the user has no aggregates', async () => {
      // Arrange
      aggregateRepo.find.mockResolvedValue([]);

      // Act
      const result = await service.getForUser(USER_A);

      // Assert
      expect(result).toEqual([]);
    });

    it('does not return rows belonging to a different user', async () => {
      // Arrange — USER_B rows should never appear for USER_A.
      aggregateRepo.find.mockImplementation(async (opts) => {
        const where = (opts as { where: { userId: string } }).where;
        if (where.userId === USER_A) {
          return [makeAggregateEntity()];
        }
        return [];
      });

      // Act
      const userAResult = await service.getForUser(USER_A);
      const userBResult = await service.getForUser(USER_B);

      // Assert
      expect(userAResult).toHaveLength(1);
      expect(userBResult).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // getForUserDeck
  // -------------------------------------------------------------------------

  describe('getForUserDeck', () => {
    it('returns the aggregate row when it exists', async () => {
      // Arrange
      const row = makeAggregateEntity();
      aggregateRepo.findOne.mockResolvedValue(row);

      // Act
      const result = await service.getForUserDeck(USER_A, DECK_ID);

      // Assert
      expect(aggregateRepo.findOne).toHaveBeenCalledWith({
        where: { userId: USER_A, deckId: DECK_ID },
      });
      expect(result).toBe(row);
    });

    it('returns null when the aggregate row does not exist', async () => {
      // Arrange
      aggregateRepo.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getForUserDeck(USER_A, DECK_ID);

      // Assert
      expect(result).toBeNull();
    });
  });
});
