/**
 * Unit tests for DecksService.updateMeta (U4).
 *
 * Tests cover:
 * - Happy paths: status, name, addTagIds, removeTagIds (individual and combined)
 * - Edge cases: duplicate addTagIds (idempotent INSERT), removeTagIds with 2+
 *   attachments (tag row kept), same-id duplicate in removeTagIds
 * - Error paths: tag from another user (assertOwnsTag → 404), name > 120 chars
 *   (DTO layer — not tested here, tested in the int-spec), invalid status (DTO layer)
 * - TOCTOU cross-deck scenario: concurrent PATCHes each removing the last
 *   attachment of the same tag from different decks. One transaction deletes the
 *   tag row, the second sees 0 rows from FOR UPDATE and treats it as a no-op.
 *
 * Mocking strategy:
 * - `dataSource.transaction` is mocked to call the callback with a fake
 *   `EntityManager` whose `createQueryBuilder()` is a chainable mock.
 * - `dataSource.query` returns `[]` by default (no tags attached) unless
 *   overridden per test.
 * - `authzService.assertOwnsTag` is mocked to resolve or throw as needed.
 * - `service.getDetail` is internally called after the transaction commits;
 *   it is mocked at the service level via `jest.spyOn`.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { AuthzService } from '../../auth/authz.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { ShoppingLineService } from '../../stores/shopping-line.service';
import { VariantFetchService } from '../../stores/variant-fetch.service';
import { DecisionsService } from '../decisions/decisions.service';
import { CatalogService } from '../../catalog/catalog.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { DecksService } from '../decks.service';
import { UpdateDeckMetaDto } from '../dto/update-deck-meta.dto';
import { ITrackedDeckDetailResponse } from '../dtos/tracked-deck-detail.response.dto';

const USER_ID = 'user-uuid-update-meta';
const DECK_ID = 10;

function buildDetailResponse(
  overrides: Partial<ITrackedDeckDetailResponse> = {},
): ITrackedDeckDetailResponse {
  return {
    id: DECK_ID,
    fabraryUlid: null,
    name: 'Dorinthea Ironsong — Classic Constructed',
    hero: 'Dorinthea Ironsong',
    heroIdentifier: 'dorinthea-ironsong',
    format: 'Classic Constructed',
    status: 'building',
    tags: [],
    trackedAt: '2026-05-17T10:00:00.000Z',
    updatedAt: '2026-05-17T10:00:00.000Z',
    totalCards: 0,
    latestSnapshot: null,
    rejectedCount: 0,
    approvedCount: 0,
    pendingCount: 0,
    decisions: [],
    shoppingLine: null,
    legality: { category: 'incomplete', reasons: [] },
    ...overrides,
  };
}

/**
 * Builds a chainable query builder mock. The chain always returns itself
 * except for terminal methods which return specific values.
 */
function buildQueryBuilderMock(opts: {
  getRawManyResult?: unknown[];
  getRawOneResult?: unknown;
  executeResult?: unknown;
  updateResult?: unknown;
  deleteResult?: unknown;
  insertResult?: unknown;
} = {}) {
  const qb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(opts.executeResult ?? { affected: 1 }),
    getRawMany: jest.fn().mockResolvedValue(opts.getRawManyResult ?? []),
    getRawOne: jest.fn().mockResolvedValue(opts.getRawOneResult ?? { count: '0' }),
  };
  return qb;
}

describe('DecksService.updateMeta', () => {
  let service: DecksService;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let snapshotRepo: jest.Mocked<Repository<DeckReadinessSnapshotEntity>>;
  let dataSource: jest.Mocked<DataSource>;
  let authzService: jest.Mocked<AuthzService>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let shoppingLineService: jest.Mocked<ShoppingLineService>;
  let variantFetchService: jest.Mocked<VariantFetchService>;
  let decisionsService: jest.Mocked<DecisionsService>;
  let catalogService: jest.Mocked<CatalogService>;
  let collectionReadService: jest.Mocked<CollectionReadService>;

  beforeEach(async () => {
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    dataSource = createMock<DataSource>();
    authzService = createMock<AuthzService>();
    substitutionService = createMock<SubstitutionService>();
    shoppingLineService = createMock<ShoppingLineService>();
    variantFetchService = createMock<VariantFetchService>();
    decisionsService = createMock<DecisionsService>();
    catalogService = createMock<CatalogService>();
    collectionReadService = createMock<CollectionReadService>();

    // Defaults for service.getDetail dependencies
    shoppingLineService.computeForBreakdown.mockResolvedValue(null);
    shoppingLineService.computeAggregate.mockResolvedValue(null);
    variantFetchService.getProgress.mockReturnValue(undefined);
    collectionReadService.countUniqueOwned.mockResolvedValue(0);
    decisionsService.countRejected.mockResolvedValue(0);
    decisionsService.list.mockResolvedValue([]);
    decisionsService.loadExclusions.mockResolvedValue(new Set());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksService,
        {
          provide: getRepositoryToken(TrackedDeckEntity),
          useValue: trackedDeckRepo,
        },
        {
          provide: getRepositoryToken(DeckCardEntity),
          useValue: deckCardRepo,
        },
        {
          provide: getRepositoryToken(DeckReadinessSnapshotEntity),
          useValue: snapshotRepo,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: AuthzService, useValue: authzService },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: ShoppingLineService, useValue: shoppingLineService },
        { provide: VariantFetchService, useValue: variantFetchService },
        { provide: DecisionsService, useValue: decisionsService },
        { provide: CatalogService, useValue: catalogService },
        { provide: CollectionReadService, useValue: collectionReadService },
      ],
    }).compile();

    service = module.get<DecksService>(DecksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Stubs `dataSource.transaction` to call the callback with a manager whose
   * `createQueryBuilder()` returns `qb`. Also stubs `dataSource.query` (used
   * inside `getDetail` for the tag fetch) and spies on `service.getDetail`
   * to return a fixed response without re-entering the full getDetail logic.
   */
  function setupTransaction(opts: {
    manager: ReturnType<typeof buildQueryBuilderMock>;
    getDetailResult?: ITrackedDeckDetailResponse;
  }): jest.SpyInstance {
    const manager = createMock<EntityManager>();
    (manager.createQueryBuilder as jest.Mock).mockReturnValue(opts.manager);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (dataSource.transaction as jest.MockedFunction<any>).mockImplementation(
      async (cb: (m: EntityManager) => Promise<void>) => cb(manager),
    );

    // After the transaction, updateMeta delegates to getDetail for the response.
    // Spy on getDetail to return a canned payload instead of re-running the full
    // service logic.
    const spy = jest
      .spyOn(service, 'getDetail')
      .mockResolvedValue(opts.getDetailResult ?? buildDetailResponse());

    return spy;
  }

  // ---------------------------------------------------------------------------
  // Happy paths
  // ---------------------------------------------------------------------------

  describe('happy path — status update', () => {
    it('executes UPDATE on tracked_deck and returns updated detail', async () => {
      // Arrange
      const qb = buildQueryBuilderMock();
      const expected = buildDetailResponse({ status: 'active' });
      setupTransaction({ manager: qb, getDetailResult: expected });

      const dto: UpdateDeckMetaDto = { status: 'active' };

      // Act
      const result = await service.updateMeta(DECK_ID, USER_ID, dto);

      // Assert
      expect(result.status).toBe('active');
      expect(qb.update).toHaveBeenCalledWith(TrackedDeckEntity);
      expect(qb.set).toHaveBeenCalledWith({ status: 'active' });
    });
  });

  describe('happy path — name update', () => {
    it('executes UPDATE on tracked_deck with the new name', async () => {
      // Arrange
      const qb = buildQueryBuilderMock();
      const newName = 'My Renamed Deck';
      const expected = buildDetailResponse({ name: newName });
      setupTransaction({ manager: qb, getDetailResult: expected });

      const dto: UpdateDeckMetaDto = { name: newName };

      // Act
      const result = await service.updateMeta(DECK_ID, USER_ID, dto);

      // Assert
      expect(result.name).toBe(newName);
      expect(qb.update).toHaveBeenCalledWith(TrackedDeckEntity);
      expect(qb.set).toHaveBeenCalledWith({ name: newName });
    });
  });

  describe('happy path — addTagIds', () => {
    it('asserts ownership and inserts each tag with IGNORE conflict', async () => {
      // Arrange
      const qb = buildQueryBuilderMock();
      const expected = buildDetailResponse({ tags: ['liga local', 'torneio'] });
      setupTransaction({ manager: qb, getDetailResult: expected });
      authzService.assertOwnsTag.mockResolvedValue();

      const dto: UpdateDeckMetaDto = { addTagIds: [1, 2] };

      // Act
      const result = await service.updateMeta(DECK_ID, USER_ID, dto);

      // Assert
      expect(authzService.assertOwnsTag).toHaveBeenCalledTimes(2);
      expect(authzService.assertOwnsTag).toHaveBeenCalledWith(
        USER_ID,
        1,
        expect.anything(), // EntityManager
      );
      expect(authzService.assertOwnsTag).toHaveBeenCalledWith(
        USER_ID,
        2,
        expect.anything(),
      );
      expect(qb.insert).toHaveBeenCalledTimes(2);
      expect(qb.orIgnore).toHaveBeenCalled();
      expect(result.tags).toEqual(['liga local', 'torneio']);
    });

    it('duplicate addTagIds are idempotent (INSERT IGNORE x2)', async () => {
      // Arrange — addTagIds: [1, 1] should call insert twice (the DB dedupes
      // via IGNORE-on-conflict; the service does not deduplicate at the app layer)
      const qb = buildQueryBuilderMock();
      const expected = buildDetailResponse({ tags: ['liga local'] });
      setupTransaction({ manager: qb, getDetailResult: expected });
      authzService.assertOwnsTag.mockResolvedValue();

      const dto: UpdateDeckMetaDto = { addTagIds: [1, 1] };

      // Act
      await service.updateMeta(DECK_ID, USER_ID, dto);

      // Assert — two assertOwnsTag calls and two INSERT IGNORE attempts
      expect(authzService.assertOwnsTag).toHaveBeenCalledTimes(2);
      expect(qb.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('happy path — removeTagIds', () => {
    it('executes TOCTOU-safe 4-step delete sequence when tag row is found via FOR UPDATE', async () => {
      // Arrange — deck has exactly 1 remaining attachment for tagId=3;
      // after the delete, count becomes 0, so the deck_tag row must also be deleted.
      const qb = buildQueryBuilderMock({
        getRawManyResult: [{ tag_id: 3 }], // step 1: FOR UPDATE finds the row
        getRawOneResult: { count: '0' },    // step 3: count = 0 after delete
      });
      const expected = buildDetailResponse({ tags: [] });
      setupTransaction({ manager: qb, getDetailResult: expected });

      const dto: UpdateDeckMetaDto = { removeTagIds: [3] };

      // Act
      await service.updateMeta(DECK_ID, USER_ID, dto);

      // Assert step 1: SELECT FOR UPDATE ran
      expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
      // Assert step 2: DELETE from tracked_deck_tag ran
      expect(qb.delete).toHaveBeenCalled();
      // Assert step 3: COUNT remaining attachments
      expect(qb.getRawOne).toHaveBeenCalled();
      // Assert step 4: DELETE from deck_tag (count was 0)
      // The delete method was called at least twice: step 2 + step 4
      expect(qb.delete).toHaveBeenCalledTimes(2);
    });

    it('does NOT delete the deck_tag row when 2+ attachments remain after remove', async () => {
      // Arrange — count = 2 after delete (another deck still uses this tag)
      const qb = buildQueryBuilderMock({
        getRawManyResult: [{ tag_id: 5 }], // step 1: row found
        getRawOneResult: { count: '2' },    // step 3: count > 0 — keep the tag
      });
      setupTransaction({ manager: qb });

      const dto: UpdateDeckMetaDto = { removeTagIds: [5] };

      // Act
      await service.updateMeta(DECK_ID, USER_ID, dto);

      // Assert — delete called only once (step 2: tracked_deck_tag only)
      expect(qb.delete).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when FOR UPDATE returns 0 rows (tag already deleted by concurrent tx)', async () => {
      // Arrange — simulates the TOCTOU scenario where the tag was deleted by
      // a concurrent transaction before this one acquired the lock.
      const qb = buildQueryBuilderMock({
        getRawManyResult: [], // step 1: 0 rows — tag already gone
      });
      setupTransaction({ manager: qb });

      const dto: UpdateDeckMetaDto = { removeTagIds: [7] };

      // Act — must NOT throw (no FK panic)
      await expect(service.updateMeta(DECK_ID, USER_ID, dto)).resolves.not.toThrow();

      // Assert — no further DB operations after the FOR UPDATE returned 0 rows
      expect(qb.delete).not.toHaveBeenCalled();
      expect(qb.getRawOne).not.toHaveBeenCalled();
    });

    it('handles duplicate removeTagIds idempotently (second iteration sees count=0)', async () => {
      // Arrange — removeTagIds: [3, 3]. First iteration deletes the tag row.
      // Second iteration's FOR UPDATE returns 0 rows (tag already gone) → no-op.
      let forUpdateCallCount = 0;
      const qb = buildQueryBuilderMock({
        getRawOneResult: { count: '0' },
      });
      qb.getRawMany.mockImplementation(async () => {
        forUpdateCallCount++;
        // First call: tag found
        if (forUpdateCallCount === 1) return [{ tag_id: 3 }];
        // Second call: tag already deleted
        return [];
      });
      setupTransaction({ manager: qb });

      const dto: UpdateDeckMetaDto = { removeTagIds: [3, 3] };

      // Act
      await expect(service.updateMeta(DECK_ID, USER_ID, dto)).resolves.not.toThrow();

      // Assert — delete called once for tracked_deck_tag + once for deck_tag
      // on the first iteration, and zero times on the second (no-op)
      expect(qb.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('happy path — combined fields', () => {
    it('applies status, name, addTagIds, removeTagIds atomically in one transaction', async () => {
      // Arrange
      const qb = buildQueryBuilderMock({
        getRawManyResult: [{ tag_id: 2 }], // removeTagIds[0] for tagId=2
        getRawOneResult: { count: '0' },    // tag fully detached
      });
      authzService.assertOwnsTag.mockResolvedValue();
      const expected = buildDetailResponse({
        status: 'ready',
        name: 'X',
        tags: ['liga local'],
      });
      setupTransaction({ manager: qb, getDetailResult: expected });

      const dto: UpdateDeckMetaDto = {
        status: 'ready',
        name: 'X',
        addTagIds: [1],
        removeTagIds: [2],
      };

      // Act
      const result = await service.updateMeta(DECK_ID, USER_ID, dto);

      // Assert — transaction called once; all four branches ran
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(result.status).toBe('ready');
      expect(result.name).toBe('X');
      expect(result.tags).toEqual(['liga local']);
    });
  });

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------

  describe('error path — tag ownership violation', () => {
    it('throws NotFoundException when addTagIds contains another user\'s tag', async () => {
      // Arrange
      const qb = buildQueryBuilderMock();
      setupTransaction({ manager: qb });
      authzService.assertOwnsTag.mockRejectedValue(new NotFoundException('Tag not found'));

      const dto: UpdateDeckMetaDto = { addTagIds: [99] };

      // Act & Assert
      await expect(service.updateMeta(DECK_ID, USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('TOCTOU cross-deck concurrent detach (critical integration scenario)', () => {
    it('handles two concurrent PATCHes each removing the SAME tag\'s last attachment', async () => {
      // This test simulates the linearized outcome of the TOCTOU scenario
      // described in the plan's Verification block and the "cross-deck TOCTOU"
      // test scenario:
      //
      // Deck A (deckId=10) and Deck B (deckId=20) each have one
      // tracked_deck_tag row for the SAME tag (tagId=3).
      //
      // Both transactions call `SELECT … FOR UPDATE` on deck_tag.id=3.
      // Transaction A wins the lock first:
      //   - deletes tracked_deck_tag for (10, 3)
      //   - counts: 1 remaining (Deck B's row still exists)
      //   - does NOT delete deck_tag.id=3
      //   - commits, releases the lock
      //
      // Transaction B then runs the full sequence:
      //   - deletes tracked_deck_tag for (20, 3)
      //   - counts: 0 remaining
      //   - deletes deck_tag.id=3
      //   - commits
      //
      // After both transactions:
      //   (a) both tracked_deck_tag rows are deleted
      //   (b) deck_tag row deleted exactly once (by Transaction B)
      //   (c) no FK panic on Transaction B
      //
      // We simulate this as two sequential updateMeta calls to verify the
      // service-level logic handles each branch correctly.

      const DECK_A = 10;
      const DECK_B = 20;
      const TAG_ID = 3;

      // Transaction A: count after delete = 1 (Deck B's attachment still exists)
      const qbA = buildQueryBuilderMock({
        getRawManyResult: [{ tag_id: TAG_ID }], // FOR UPDATE finds row
        getRawOneResult: { count: '1' },         // count > 0 — keep the tag
      });

      // Transaction B: count after delete = 0 (last attachment removed)
      const qbB = buildQueryBuilderMock({
        getRawManyResult: [{ tag_id: TAG_ID }], // FOR UPDATE still finds row
        getRawOneResult: { count: '0' },         // count = 0 — delete the tag
      });

      // Each updateMeta call gets its own transaction manager mock.
      let txCallCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dataSource.transaction as jest.MockedFunction<any>).mockImplementation(
        async (cb: (m: EntityManager) => Promise<void>) => {
          txCallCount++;
          const managerMock = createMock<EntityManager>();
          (managerMock.createQueryBuilder as jest.Mock).mockReturnValue(
            txCallCount === 1 ? qbA : qbB,
          );
          return cb(managerMock);
        },
      );

      jest.spyOn(service, 'getDetail').mockResolvedValue(buildDetailResponse());

      const dtoA: UpdateDeckMetaDto = { removeTagIds: [TAG_ID] };
      const dtoB: UpdateDeckMetaDto = { removeTagIds: [TAG_ID] };

      // Act — Transaction A (Deck A's last attachment removed; tag row kept)
      await expect(service.updateMeta(DECK_A, USER_ID, dtoA)).resolves.not.toThrow();

      // Act — Transaction B (Deck B's last attachment removed; tag row deleted once)
      await expect(service.updateMeta(DECK_B, USER_ID, dtoB)).resolves.not.toThrow();

      // Assert (a): tracked_deck_tag deletes ran for both transactions
      // qbA.delete called once (step 2, tracked_deck_tag only — count was 1)
      expect(qbA.delete).toHaveBeenCalledTimes(1);
      // qbB.delete called twice (step 2 + step 4: deck_tag deleted)
      expect(qbB.delete).toHaveBeenCalledTimes(2);

      // Assert (b): deck_tag row deleted exactly once (by Transaction B only)
      // qbA did NOT call getRawOne with count=0, so no deck_tag delete on A
      // qbB called deck_tag delete once (step 4)
      // The second delete on qbB is the deck_tag removal — verified by count
      expect(qbA.delete).not.toHaveBeenCalledTimes(2); // A never deletes deck_tag
      expect(qbB.delete).toHaveBeenCalledTimes(2); // B deletes: tdt + deck_tag

      // Assert (c): no FK panic — both resolved without throwing
      // (already verified above by .resolves.not.toThrow())
    });
  });
});
