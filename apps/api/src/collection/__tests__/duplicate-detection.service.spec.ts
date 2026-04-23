import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import {
  DuplicateDetectionService,
  computeJaccard,
  computeDelta,
} from '../csv/duplicate-detection.service';
import { JACCARD_THRESHOLD } from '../csv/jaccard-threshold';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-uuid-dup-001';
const SOURCE_A_ID = 'csv-source-uuid-a';
const SOURCE_B_ID = 'csv-source-uuid-b';
const HASH_A = 'aaaa1234567890abcdefabcdef1234567890abcdefabcdef1234567890abcdef';
const HASH_B = 'bbbb1234567890abcdefabcdef1234567890abcdefabcdef1234567890bbbb00';
const NEW_HASH = 'ffff1234567890abcdefabcdef1234567890abcdefabcdef1234567890ffff00';

function buildSource(overrides: Partial<CsvSourceEntity> = {}): CsvSourceEntity {
  return {
    id: SOURCE_A_ID,
    userId: USER_ID,
    kind: 'csv',
    label: 'My CSV',
    originalFilename: 'collection.csv',
    sourceUrl: null,
    contentHash: HASH_A,
    cardCount: null,
    active: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    user: {} as CsvSourceEntity['user'],
    ...overrides,
  };
}

function buildCard(
  sourceId: string,
  cardIdentifier: string,
  quantity = 1,
): CollectionCardEntity {
  return {
    id: 1,
    userId: USER_ID,
    sourceId,
    cardIdentifier,
    quantity,
    lastUpdated: new Date('2025-01-15T10:00:00Z'),
    user: {} as CollectionCardEntity['user'],
    source: {} as CollectionCardEntity['source'],
  };
}

// ---------------------------------------------------------------------------
// Module setup
// ---------------------------------------------------------------------------

describe('DuplicateDetectionService', () => {
  let service: DuplicateDetectionService;
  let csvSourceRepo: jest.Mocked<Repository<CsvSourceEntity>>;
  let collectionCardRepo: jest.Mocked<Repository<CollectionCardEntity>>;

  beforeEach(async () => {
    csvSourceRepo = createMock<Repository<CsvSourceEntity>>();
    collectionCardRepo = createMock<Repository<CollectionCardEntity>>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DuplicateDetectionService,
        {
          provide: getRepositoryToken(CsvSourceEntity),
          useValue: csvSourceRepo,
        },
        {
          provide: getRepositoryToken(CollectionCardEntity),
          useValue: collectionCardRepo,
        },
      ],
    }).compile();

    service = module.get<DuplicateDetectionService>(DuplicateDetectionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // No existing sources
  // -------------------------------------------------------------------------

  describe('when user has zero existing CSV sources', () => {
    it('returns new without error', async () => {
      // Arrange
      csvSourceRepo.find.mockResolvedValue([]);

      // Act
      const result = await service.detect(
        USER_ID,
        new Set(['card-a']),
        new Map([['card-a', 1]]),
        NEW_HASH,
      );

      // Assert
      expect(result.kind).toBe('new');
      expect(collectionCardRepo.find).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Exact-match detection
  // -------------------------------------------------------------------------

  describe('exact-match', () => {
    it('returns exact-match when content hash matches an existing source', async () => {
      // Arrange: source has contentHash === HASH_A; incoming also has HASH_A.
      const source = buildSource({ contentHash: HASH_A });
      csvSourceRepo.find.mockResolvedValue([source]);
      collectionCardRepo.find.mockResolvedValue([
        buildCard(SOURCE_A_ID, 'card-a', 2),
        buildCard(SOURCE_A_ID, 'card-b', 1),
      ]);

      const incomingSet = new Set(['card-a', 'card-b']);
      const incomingQtys = new Map([['card-a', 2], ['card-b', 1]]);

      // Act
      const result = await service.detect(USER_ID, incomingSet, incomingQtys, HASH_A);

      // Assert
      expect(result.kind).toBe('exact-match');
      if (result.kind === 'exact-match') {
        expect(result.existingSourceId).toBe(SOURCE_A_ID);
        expect(result.existingLabel).toBe('My CSV');
        expect(result.cardCount).toBe(2);
      }
    });

    it('returns exact-match with the correct existing source when multiple sources exist', async () => {
      // Arrange: two sources, incoming hash matches source B.
      const sourceA = buildSource({ id: SOURCE_A_ID, contentHash: HASH_A });
      const sourceB = buildSource({ id: SOURCE_B_ID, contentHash: HASH_B, label: 'CSV B' });
      csvSourceRepo.find.mockResolvedValue([sourceA, sourceB]);
      collectionCardRepo.find.mockResolvedValue([
        buildCard(SOURCE_B_ID, 'card-x', 1),
      ]);

      // Act
      const result = await service.detect(
        USER_ID,
        new Set(['card-x']),
        new Map([['card-x', 1]]),
        HASH_B,
      );

      // Assert
      expect(result.kind).toBe('exact-match');
      if (result.kind === 'exact-match') {
        expect(result.existingSourceId).toBe(SOURCE_B_ID);
        expect(result.existingLabel).toBe('CSV B');
      }
    });

    it('returns exact-match when rows are reordered (same hash due to normalization)', async () => {
      // The hash comparison is purely string equality; this test verifies the
      // detect layer handles hash equality correctly.
      const source = buildSource({ contentHash: HASH_A });
      csvSourceRepo.find.mockResolvedValue([source]);
      collectionCardRepo.find.mockResolvedValue([]);

      // Act: pass the same hash as the existing source.
      const result = await service.detect(
        USER_ID,
        new Set(['card-a']),
        new Map([['card-a', 1]]),
        HASH_A, // Same hash as source → exact-match regardless of idSet content.
      );

      // Assert
      expect(result.kind).toBe('exact-match');
    });
  });

  // -------------------------------------------------------------------------
  // Partial-overlap detection
  // -------------------------------------------------------------------------

  describe('partial-overlap', () => {
    it('returns partial-overlap when Jaccard ≥ 0.5 and no exact hash match', async () => {
      // Arrange: existing has 5 cards; incoming has 5 with 4 shared.
      // Jaccard = 4 / (5 + 5 - 4) = 4/6 ≈ 0.667 → partial overlap.
      const source = buildSource({ contentHash: HASH_A });
      csvSourceRepo.find.mockResolvedValue([source]);
      collectionCardRepo.find.mockResolvedValue([
        buildCard(SOURCE_A_ID, 'card-a', 1),
        buildCard(SOURCE_A_ID, 'card-b', 1),
        buildCard(SOURCE_A_ID, 'card-c', 1),
        buildCard(SOURCE_A_ID, 'card-d', 1),
        buildCard(SOURCE_A_ID, 'card-e', 1),
      ]);

      // Incoming: 4 shared + 1 new (card-f).
      const incomingSet = new Set(['card-a', 'card-b', 'card-c', 'card-d', 'card-f']);
      const incomingQtys = new Map([
        ['card-a', 1], ['card-b', 1], ['card-c', 1], ['card-d', 1], ['card-f', 1],
      ]);

      // Act: hash does NOT match HASH_A.
      const result = await service.detect(USER_ID, incomingSet, incomingQtys, NEW_HASH);

      // Assert
      expect(result.kind).toBe('partial-overlap');
      if (result.kind === 'partial-overlap') {
        expect(result.existingSourceId).toBe(SOURCE_A_ID);
        expect(result.similarityScore).toBeCloseTo(4 / 6, 5);
        expect(result.delta.added.map((e) => e.cardIdentifier)).toContain('card-f');
        expect(result.delta.removed.map((e) => e.cardIdentifier)).toContain('card-e');
      }
    });

    it('returns partial-overlap at exactly the Jaccard threshold (0.5 is inclusive)', async () => {
      // Exact 0.5: source has {A,B}; incoming has {A,B,C,D}.
      // intersection=2, union=4 → 2/4 = 0.5. ✓
      const source = buildSource({ contentHash: HASH_A });
      csvSourceRepo.find.mockResolvedValue([source]);
      collectionCardRepo.find.mockResolvedValue([
        buildCard(SOURCE_A_ID, 'card-a', 1),
        buildCard(SOURCE_A_ID, 'card-b', 1),
      ]);

      const incomingSet = new Set(['card-a', 'card-b', 'card-c', 'card-d']);
      const incomingQtys = new Map([
        ['card-a', 1], ['card-b', 1], ['card-c', 1], ['card-d', 1],
      ]);

      // Act: hash does NOT match.
      const result = await service.detect(USER_ID, incomingSet, incomingQtys, NEW_HASH);

      // Assert: Jaccard = 2/4 = 0.5 → partial overlap (inclusive threshold).
      expect(result.kind).toBe('partial-overlap');
      if (result.kind === 'partial-overlap') {
        expect(result.similarityScore).toBeCloseTo(0.5, 5);
      }
    });

    it('includes correct delta: added, removed, increased, decreased', async () => {
      // Existing: {A:1, B:2, C:3, D:1, E:1}; incoming: {A:2, B:1, C:3, D:1, F:1}
      // Jaccard: intersection={A,B,C,D}=4, union={A,B,C,D,E,F}=6 → 4/6 ≈ 0.667
      // Delta:
      //   added: F (new)
      //   removed: E (gone)
      //   increased: A (1→2)
      //   decreased: B (2→1)
      //   unchanged: C and D — not in delta
      const source = buildSource({ contentHash: HASH_A });
      csvSourceRepo.find.mockResolvedValue([source]);
      collectionCardRepo.find.mockResolvedValue([
        buildCard(SOURCE_A_ID, 'card-a', 1),
        buildCard(SOURCE_A_ID, 'card-b', 2),
        buildCard(SOURCE_A_ID, 'card-c', 3),
        buildCard(SOURCE_A_ID, 'card-d', 1),
        buildCard(SOURCE_A_ID, 'card-e', 1),
      ]);

      const incomingSet = new Set(['card-a', 'card-b', 'card-c', 'card-d', 'card-f']);
      const incomingQtys = new Map([
        ['card-a', 2],  // increased (was 1)
        ['card-b', 1],  // decreased (was 2)
        ['card-c', 3],  // unchanged
        ['card-d', 1],  // unchanged
        ['card-f', 1],  // added (new card)
      ]);

      // Act
      const result = await service.detect(USER_ID, incomingSet, incomingQtys, NEW_HASH);

      // Assert
      expect(result.kind).toBe('partial-overlap');
      if (result.kind === 'partial-overlap') {
        const { delta } = result;
        // Added: card-f
        expect(delta.added.map((e) => e.cardIdentifier)).toContain('card-f');
        expect(delta.added).toHaveLength(1);
        // Removed: card-e
        expect(delta.removed.map((e) => e.cardIdentifier)).toContain('card-e');
        expect(delta.removed).toHaveLength(1);
        // Increased: card-a (1→2)
        expect(delta.increased.map((e) => e.cardIdentifier)).toContain('card-a');
        const increased = delta.increased.find((e) => e.cardIdentifier === 'card-a');
        expect(increased?.previousQuantity).toBe(1);
        expect(increased?.newQuantity).toBe(2);
        // Decreased: card-b (2→1)
        expect(delta.decreased.map((e) => e.cardIdentifier)).toContain('card-b');
        const decreased = delta.decreased.find((e) => e.cardIdentifier === 'card-b');
        expect(decreased?.previousQuantity).toBe(2);
        expect(decreased?.newQuantity).toBe(1);
      }
    });
  });

  // -------------------------------------------------------------------------
  // New source detection
  // -------------------------------------------------------------------------

  describe('new source', () => {
    it('returns new when Jaccard is below threshold (3/7 ≈ 0.43)', async () => {
      // Arrange: existing 5 cards; incoming 5, sharing 3.
      // Jaccard = 3 / (5+5-3) = 3/7 ≈ 0.43 < 0.5 → new.
      const source = buildSource({ contentHash: HASH_A });
      csvSourceRepo.find.mockResolvedValue([source]);
      collectionCardRepo.find.mockResolvedValue([
        buildCard(SOURCE_A_ID, 'card-a', 1),
        buildCard(SOURCE_A_ID, 'card-b', 1),
        buildCard(SOURCE_A_ID, 'card-c', 1),
        buildCard(SOURCE_A_ID, 'card-d', 1),
        buildCard(SOURCE_A_ID, 'card-e', 1),
      ]);

      // Incoming: 3 shared + 2 new.
      const incomingSet = new Set(['card-a', 'card-b', 'card-c', 'card-x', 'card-y']);
      const incomingQtys = new Map([
        ['card-a', 1], ['card-b', 1], ['card-c', 1], ['card-x', 1], ['card-y', 1],
      ]);

      // Act: hash does NOT match.
      const result = await service.detect(USER_ID, incomingSet, incomingQtys, NEW_HASH);

      // Assert: 3/7 < 0.5 → new.
      expect(result.kind).toBe('new');
    });

    it('returns new when incoming set is empty (Jaccard vs any non-empty set is 0)', async () => {
      // Arrange: existing has cards; incoming is empty.
      const source = buildSource({ contentHash: HASH_A });
      csvSourceRepo.find.mockResolvedValue([source]);
      collectionCardRepo.find.mockResolvedValue([
        buildCard(SOURCE_A_ID, 'card-a', 1),
      ]);

      // Act
      const result = await service.detect(USER_ID, new Set(), new Map(), NEW_HASH);

      // Assert: empty set vs any non-empty → Jaccard 0 → new.
      expect(result.kind).toBe('new');
    });
  });
});

// ---------------------------------------------------------------------------
// computeJaccard (pure helper)
// ---------------------------------------------------------------------------

describe('computeJaccard', () => {
  it('returns 1.0 for identical non-empty sets', () => {
    const a = new Set(['x', 'y', 'z']);
    const b = new Set(['x', 'y', 'z']);
    expect(computeJaccard(a, b)).toBe(1);
  });

  it('returns 0.0 for disjoint sets', () => {
    const a = new Set(['a', 'b']);
    const b = new Set(['c', 'd']);
    expect(computeJaccard(a, b)).toBe(0);
  });

  it('returns 0.5 for the inclusive-threshold case (|A|=4, |B|=2, intersection=2 → union=4)', () => {
    const a = new Set(['a', 'b', 'c', 'd']);
    const b = new Set(['a', 'b']);
    expect(computeJaccard(a, b)).toBeCloseTo(0.5, 5);
  });

  it('returns 0.0 for two empty sets', () => {
    expect(computeJaccard(new Set(), new Set())).toBe(0);
  });

  it('returns 0.0 for one empty and one non-empty set', () => {
    const a = new Set<string>();
    const b = new Set(['x']);
    expect(computeJaccard(a, b)).toBe(0);
    expect(computeJaccard(b, a)).toBe(0);
  });

  it('respects the threshold boundary: exactly JACCARD_THRESHOLD is >= threshold', () => {
    // This verifies the threshold constant is used correctly.
    const a = new Set(['a', 'b', 'c', 'd']);
    const b = new Set(['a', 'b']);
    const score = computeJaccard(a, b); // 0.5 exactly
    expect(score).toBeCloseTo(JACCARD_THRESHOLD, 5);
    expect(score >= JACCARD_THRESHOLD).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeDelta (pure helper)
// ---------------------------------------------------------------------------

describe('computeDelta', () => {
  it('correctly identifies added cards', () => {
    // Arrange: card-new is in incoming but not existing.
    const incomingSet = new Set(['card-a', 'card-new']);
    const incomingQtys = new Map([['card-a', 1], ['card-new', 2]]);
    const existingQtys = new Map([['card-a', 1]]);

    // Act
    const delta = computeDelta(incomingSet, incomingQtys, existingQtys);

    // Assert
    expect(delta.added).toHaveLength(1);
    const added = delta.added.find((e) => e.cardIdentifier === 'card-new');
    expect(added?.cardIdentifier).toBe('card-new');
    expect(added?.quantity).toBe(2);
    expect(delta.removed).toHaveLength(0);
  });

  it('correctly identifies removed cards', () => {
    // Arrange: card-old is in existing but not incoming.
    const incomingSet = new Set(['card-a']);
    const incomingQtys = new Map([['card-a', 1]]);
    const existingQtys = new Map([['card-a', 1], ['card-old', 3]]);

    // Act
    const delta = computeDelta(incomingSet, incomingQtys, existingQtys);

    // Assert
    expect(delta.removed).toHaveLength(1);
    const removed = delta.removed.find((e) => e.cardIdentifier === 'card-old');
    expect(removed?.cardIdentifier).toBe('card-old');
    expect(removed?.quantity).toBe(3);
    expect(delta.added).toHaveLength(0);
  });

  it('correctly identifies quantity increases', () => {
    // Arrange: card-a quantity 1→3.
    const incomingSet = new Set(['card-a']);
    const incomingQtys = new Map([['card-a', 3]]);
    const existingQtys = new Map([['card-a', 1]]);

    // Act
    const delta = computeDelta(incomingSet, incomingQtys, existingQtys);

    // Assert
    expect(delta.increased).toHaveLength(1);
    const inc = delta.increased.find((e) => e.cardIdentifier === 'card-a');
    expect(inc?.previousQuantity).toBe(1);
    expect(inc?.newQuantity).toBe(3);
    expect(delta.decreased).toHaveLength(0);
  });

  it('correctly identifies quantity decreases', () => {
    // Arrange: card-a quantity 5→2.
    const incomingSet = new Set(['card-a']);
    const incomingQtys = new Map([['card-a', 2]]);
    const existingQtys = new Map([['card-a', 5]]);

    // Act
    const delta = computeDelta(incomingSet, incomingQtys, existingQtys);

    // Assert
    expect(delta.decreased).toHaveLength(1);
    const dec = delta.decreased.find((e) => e.cardIdentifier === 'card-a');
    expect(dec?.previousQuantity).toBe(5);
    expect(dec?.newQuantity).toBe(2);
    expect(delta.increased).toHaveLength(0);
  });

  it('omits cards with unchanged quantity from the delta', () => {
    // Arrange: card-a has the same quantity in both.
    const incomingSet = new Set(['card-a']);
    const incomingQtys = new Map([['card-a', 2]]);
    const existingQtys = new Map([['card-a', 2]]);

    // Act
    const delta = computeDelta(incomingSet, incomingQtys, existingQtys);

    // Assert: all delta arrays should be empty.
    expect(delta.added).toHaveLength(0);
    expect(delta.removed).toHaveLength(0);
    expect(delta.increased).toHaveLength(0);
    expect(delta.decreased).toHaveLength(0);
  });

  it('handles an empty incoming set (all existing cards removed)', () => {
    // Arrange
    const incomingSet = new Set<string>();
    const incomingQtys = new Map<string, number>();
    const existingQtys = new Map([['card-a', 1], ['card-b', 2]]);

    // Act
    const delta = computeDelta(incomingSet, incomingQtys, existingQtys);

    // Assert
    expect(delta.removed).toHaveLength(2);
    expect(delta.added).toHaveLength(0);
    expect(delta.increased).toHaveLength(0);
    expect(delta.decreased).toHaveLength(0);
  });

  it('handles both sets empty producing an empty delta', () => {
    // Arrange
    const delta = computeDelta(new Set(), new Map(), new Map());

    // Assert
    expect(delta.added).toHaveLength(0);
    expect(delta.removed).toHaveLength(0);
    expect(delta.increased).toHaveLength(0);
    expect(delta.decreased).toHaveLength(0);
  });
});
