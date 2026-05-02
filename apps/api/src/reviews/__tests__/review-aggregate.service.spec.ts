import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { ReviewAggregateService } from '../review-aggregate.service';
import { ReviewAggregateEntity } from '../../database/entities/review-aggregate.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SubstituteDecisionEntity } from '../../database/entities/substitute-decision.entity';
import { CatalogService } from '../../catalog/catalog.service';

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
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let decisionRepo: jest.Mocked<Repository<SubstituteDecisionEntity>>;
  let catalogService: jest.Mocked<CatalogService>;

  beforeEach(async () => {
    aggregateRepo = createMock<Repository<ReviewAggregateEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    decisionRepo = createMock<Repository<SubstituteDecisionEntity>>();
    catalogService = createMock<CatalogService>();
    // Default: every catalog lookup returns an Action card. Individual tests
    // override via `catalogService.getCard.mockImplementation(...)`.
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
        { provide: CatalogService, useValue: catalogService },
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

  // -------------------------------------------------------------------------
  // listSubstitutionRows
  // -------------------------------------------------------------------------

  describe('listSubstitutionRows', () => {
    const ORIGINAL_IMAGE = {
      small: 'https://cdn.example/orig-small.webp',
      large: 'https://cdn.example/orig-large.webp',
      sources: [
        {
          small: 'https://cdn.example/orig-small.webp',
          large: 'https://cdn.example/orig-large.webp',
        },
      ],
    };
    const SUBSTITUTE_IMAGE = {
      small: 'https://cdn.example/sub-small.webp',
      large: 'https://cdn.example/sub-large.webp',
      sources: [
        {
          small: 'https://cdn.example/sub-small.webp',
          large: 'https://cdn.example/sub-large.webp',
        },
      ],
    };

    function makeEnrichedSubstitutionSnapshot(
      trackedDeckId: number = DECK_ID,
    ): DeckReadinessSnapshotEntity {
      return {
        id: 90,
        trackedDeckId,
        rawPercent: 80,
        effectivePercent: 100,
        breakdown: {
          exact: [],
          substituted: [
            {
              original: {
                cardIdentifier: 'FaB-orig (1)',
                quantity: 1,
                slot: 'main',
                pitch: 2,
                cost: 1,
                type: 'Action',
                imageUrl: ORIGINAL_IMAGE,
              },
              match: {
                substitute: {
                  cardIdentifier: 'FaB-sub (1)',
                  name: 'Substitute Card',
                  classes: ['Generic'],
                  pitch: 1,
                  power: null,
                  defense: null,
                  keywords: [],
                  imageUrl: SUBSTITUTE_IMAGE,
                },
                tier: 2,
                score: 0.83,
                rationale: 'similar effect, lower power',
              },
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

    function stubLatestSnapshotsQuery(
      snapshots: readonly DeckReadinessSnapshotEntity[],
    ): void {
      snapshotRepo.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(snapshots),
      });
    }

    it('returns rows enriched with hero, tier, confidence, decision, image URLs, and pitch/type pairs', async () => {
      // Arrange
      trackedDeckRepo.find.mockResolvedValue([
        { id: DECK_ID, name: 'Aggressive Briar', hero: 'Briar' } as TrackedDeckEntity,
      ]);
      stubLatestSnapshotsQuery([makeEnrichedSubstitutionSnapshot()]);
      decisionRepo.find.mockResolvedValue([]);
      catalogService.getCard.mockReturnValue({
        cardIdentifier: 'FaB-sub (1)',
        name: 'Substitute Card',
        classes: ['Generic'],
        types: ['Defense Reaction'],
        pitch: 1,
        cost: null,
        power: null,
        defense: null,
        keywords: [],
        imageUrl: null,
      } as unknown as ReturnType<CatalogService['getCard']>);

      // Act — request 'all' so the pending row is not filtered out.
      const rows = await service.listSubstitutionRows(USER_A, 'all');

      // Assert
      expect(rows).toHaveLength(1);
      const row = rows[0]!;
      expect(row.trackedDeckId).toBe(DECK_ID);
      expect(row.deckName).toBe('Aggressive Briar');
      expect(row.hero).toBe('Briar');
      expect(row.cardIdentifier).toBe('FaB-orig (1)');
      expect(row.substituteIdentifier).toBe('FaB-sub (1)');
      expect(row.substituteName).toBe('Substitute Card');
      expect(row.tier).toBe(2);
      // 0.83 → 83
      expect(row.confidence).toBe(83);
      expect(row.rationale).toBe('similar effect, lower power');
      expect(row.decision).toBe('pending');
      expect(row.originalImageUrl).toEqual({
        small: ORIGINAL_IMAGE.small,
        large: ORIGINAL_IMAGE.large,
      });
      // The wire format must NOT carry `sources`.
      expect(row.originalImageUrl).not.toHaveProperty('sources');
      expect(row.substituteImageUrl).toEqual({
        small: SUBSTITUTE_IMAGE.small,
        large: SUBSTITUTE_IMAGE.large,
      });
      expect(row.originalPitch).toBe(2);
      expect(row.substitutePitch).toBe(1);
      expect(row.originalType).toBe('Action');
      expect(row.substituteType).toBe('Defense Reaction');
    });

    it('uses decisionMap to surface approved/rejected decision states', async () => {
      // Arrange
      trackedDeckRepo.find.mockResolvedValue([
        { id: DECK_ID, name: 'Deck', hero: 'Briar' } as TrackedDeckEntity,
      ]);
      stubLatestSnapshotsQuery([makeEnrichedSubstitutionSnapshot()]);
      decisionRepo.find.mockResolvedValue([
        {
          trackedDeckId: DECK_ID,
          cardIdentifier: 'FaB-orig (1)',
          decision: 'approved',
        } as SubstituteDecisionEntity,
      ]);

      // Act
      const rows = await service.listSubstitutionRows(USER_A, 'all');

      // Assert
      expect(rows).toHaveLength(1);
      expect(rows[0]!.decision).toBe('approved');
    });

    it('respects the state filter and drops rows with mismatched decisions', async () => {
      // Arrange
      trackedDeckRepo.find.mockResolvedValue([
        { id: DECK_ID, name: 'Deck', hero: 'Briar' } as TrackedDeckEntity,
      ]);
      stubLatestSnapshotsQuery([makeEnrichedSubstitutionSnapshot()]);
      decisionRepo.find.mockResolvedValue([
        {
          trackedDeckId: DECK_ID,
          cardIdentifier: 'FaB-orig (1)',
          decision: 'approved',
        } as SubstituteDecisionEntity,
      ]);

      // Act — default filter is 'pending'; the only row is approved.
      const rows = await service.listSubstitutionRows(USER_A);

      // Assert
      expect(rows).toEqual([]);
    });

    it('clamps tier to {1,2,3} and falls back to type=unknown when catalog lookup throws', async () => {
      // Arrange — engine snapshot with an out-of-range tier and a substitute
      // missing from the catalog (legacy data).
      const snapshot = makeEnrichedSubstitutionSnapshot();
      const breakdown = snapshot.breakdown as unknown as {
        substituted: Array<{
          original: Record<string, unknown>;
          match: { tier: number; substitute: { cardIdentifier: string } };
        }>;
      };
      breakdown.substituted[0]!.match.tier = 7;
      trackedDeckRepo.find.mockResolvedValue([
        { id: DECK_ID, name: 'Deck', hero: 'Briar' } as TrackedDeckEntity,
      ]);
      stubLatestSnapshotsQuery([snapshot]);
      decisionRepo.find.mockResolvedValue([]);
      catalogService.getCard.mockImplementation(() => {
        throw new Error('card not in catalog');
      });

      // Act
      const rows = await service.listSubstitutionRows(USER_A, 'all');

      // Assert
      expect(rows).toHaveLength(1);
      expect(rows[0]!.tier).toBe(3);
      expect(rows[0]!.substituteType).toBe('unknown');
    });

    it('returns an empty array when the user has no tracked decks', async () => {
      trackedDeckRepo.find.mockResolvedValue([]);

      const rows = await service.listSubstitutionRows(USER_A, 'all');

      expect(rows).toEqual([]);
    });
  });
});
