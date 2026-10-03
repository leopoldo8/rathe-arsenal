import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CatalogService } from '../../catalog/catalog.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { SwapSuggestionEntity } from '../../database/entities/swap-suggestion.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SwapSuggestionQueryService } from '../swap-suggestion-query.service';
import { SwapsService } from '../swaps.service';

const USER_ID = 'user-1';
const DECK_ID = 42;
const SWAP_ID = '7b3f6a52-3d0e-4d4f-9a59-1b2f7c1d9e10';

function makeEntity(overrides: Partial<SwapSuggestionEntity> = {}): SwapSuggestionEntity {
  return {
    id: SWAP_ID,
    userId: USER_ID,
    trackedDeckId: DECK_ID,
    cardIdentifier: 'orig',
    slot: 'mainboard',
    substituteIdentifier: 'sub',
    quantity: 1,
    tier: 1,
    confidence: 90,
    rationale: 'r',
    status: 'pending',
    appliedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    rejectionNote: null,
    outcome: null,
    ...overrides,
  } as SwapSuggestionEntity;
}

describe('SwapsService', () => {
  let service: SwapsService;
  let swapRepo: jest.Mocked<Repository<SwapSuggestionEntity>>;
  let trackedDeckRepo: jest.Mocked<Repository<TrackedDeckEntity>>;
  let txSwapRepo: jest.Mocked<Repository<SwapSuggestionEntity>>;
  let manager: jest.Mocked<EntityManager>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let queryService: jest.Mocked<SwapSuggestionQueryService>;
  let collectionReadService: jest.Mocked<CollectionReadService>;

  beforeEach(async () => {
    swapRepo = createMock<Repository<SwapSuggestionEntity>>();
    trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    txSwapRepo = createMock<Repository<SwapSuggestionEntity>>();
    manager = createMock<EntityManager>();
    manager.getRepository.mockReturnValue(txSwapRepo as never);
    manager.findOne.mockResolvedValue({ id: DECK_ID } as TrackedDeckEntity);
    const dataSource = createMock<DataSource>();
    dataSource.transaction.mockImplementation((async (work: (m: EntityManager) => Promise<unknown>) =>
      work(manager)) as never);
    substitutionService = createMock<SubstitutionService>();
    substitutionService.computeAndStoreReadiness.mockResolvedValue({} as DeckReadinessSnapshotEntity);
    queryService = createMock<SwapSuggestionQueryService>();
    queryService.loadReadinessInputs.mockResolvedValue({
      excludedIdentifiers: new Set(),
      approvedIdentifiers: new Set(),
    });
    collectionReadService = createMock<CollectionReadService>();
    collectionReadService.loadOwned.mockResolvedValue(new Map([['sub', 2]]));
    const catalogService = createMock<CatalogService>();
    catalogService.getCard.mockImplementation(() => {
      throw new Error('not in catalog');
    });
    trackedDeckRepo.find.mockResolvedValue([{ id: DECK_ID, name: 'Deck', hero: 'hero' } as TrackedDeckEntity]);
    trackedDeckRepo.findOne.mockResolvedValue({ id: DECK_ID, name: 'Deck', hero: 'hero' } as TrackedDeckEntity);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwapsService,
        { provide: getRepositoryToken(SwapSuggestionEntity), useValue: swapRepo },
        { provide: getRepositoryToken(TrackedDeckEntity), useValue: trackedDeckRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: SwapSuggestionQueryService, useValue: queryService },
        { provide: CollectionReadService, useValue: collectionReadService },
        { provide: CatalogService, useValue: catalogService },
      ],
    }).compile();

    service = module.get(SwapsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('mutate', () => {
    it('locks the deck before reading the row state, so mutations on one deck run one at a time', async () => {
      const order: string[] = [];
      txSwapRepo.findOne.mockImplementation((async () => {
        order.push('read-row');
        return makeEntity({ status: 'approved' });
      }) as never);
      manager.findOne.mockImplementation((async () => {
        order.push('lock-deck');
        return { id: DECK_ID } as TrackedDeckEntity;
      }) as never);
      txSwapRepo.find.mockResolvedValue([makeEntity({ status: 'approved' })]);

      await service.mutate(USER_ID, SWAP_ID, { kind: 'approve' });

      expect(txSwapRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { id: SWAP_ID, userId: USER_ID },
        select: ['id', 'trackedDeckId'],
      });
      expect(manager.findOne).toHaveBeenCalledWith(TrackedDeckEntity, {
        where: { id: DECK_ID, userId: USER_ID },
        lock: { mode: 'for_no_key_update' },
      });
      expect(txSwapRepo.findOne).toHaveBeenNthCalledWith(2, { where: { id: SWAP_ID, userId: USER_ID } });
      expect(order).toEqual(['read-row', 'lock-deck', 'read-row']);
    });

    it('decides the transition from the row as re-read under the deck lock', async () => {
      txSwapRepo.findOne
        .mockResolvedValueOnce(makeEntity({ status: 'pending' }))
        .mockResolvedValueOnce(makeEntity({ status: 'rejected' }));

      const error = await service.mutate(USER_ID, SWAP_ID, { kind: 'approve' }).catch((e: unknown) => e);

      expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it('throws a plain 404 when the row does not exist or belongs to someone else', async () => {
      txSwapRepo.findOne.mockResolvedValue(null);

      await expect(service.mutate(USER_ID, SWAP_ID, { kind: 'approve' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(txSwapRepo.update).not.toHaveBeenCalled();
    });

    it('throws 409 INVALID_TRANSITION and writes nothing on an illegal transition', async () => {
      txSwapRepo.findOne.mockResolvedValue(makeEntity({ status: 'rejected' }));

      const error = await service.mutate(USER_ID, SWAP_ID, { kind: 'approve' }).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((error as HttpException).getResponse()).toEqual(
        expect.objectContaining({ code: 'INVALID_TRANSITION' }),
      );
      expect(txSwapRepo.update).not.toHaveBeenCalled();
      expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
    });

    it('writes the patch and recomputes readiness inside the same transaction', async () => {
      txSwapRepo.findOne.mockResolvedValue(makeEntity());
      txSwapRepo.find.mockResolvedValue([makeEntity({ status: 'approved' })]);
      const approvedIdentifiers = new Set(['key' as never]);
      const excludedIdentifiers = new Set(['other' as never]);
      queryService.loadReadinessInputs.mockResolvedValue({ excludedIdentifiers, approvedIdentifiers });

      await service.mutate(USER_ID, SWAP_ID, { kind: 'approve' });

      expect(txSwapRepo.update).toHaveBeenCalledWith(
        SWAP_ID,
        expect.objectContaining({ status: 'approved', appliedAt: expect.any(Date) }),
      );
      expect(queryService.loadReadinessInputs).toHaveBeenCalledWith(DECK_ID, manager);
      expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(
        DECK_ID,
        USER_ID,
        excludedIdentifiers,
        approvedIdentifiers,
        manager,
      );
    });

    it('writes before recomputing, so the recompute sees the new status', async () => {
      const order: string[] = [];
      txSwapRepo.findOne.mockResolvedValue(makeEntity());
      txSwapRepo.find.mockResolvedValue([makeEntity({ status: 'rejected' })]);
      txSwapRepo.update.mockImplementation((async () => {
        order.push('update');
      }) as never);
      queryService.loadReadinessInputs.mockImplementation(async () => {
        order.push('load');
        return { excludedIdentifiers: new Set(), approvedIdentifiers: new Set() };
      });

      await service.mutate(USER_ID, SWAP_ID, { kind: 'reject' });

      expect(order).toEqual(['update', 'load']);
    });

    it('returns every live row for the deck plus the acted-on row', async () => {
      const other = makeEntity({ id: 'other-id', substituteIdentifier: 'sub-2' });
      const retiredSibling = makeEntity({ id: 'retired-id', status: 'retired' });
      txSwapRepo.findOne.mockResolvedValue(makeEntity());
      txSwapRepo.find.mockResolvedValue([makeEntity({ status: 'approved' }), other, retiredSibling]);

      const result = await service.mutate(USER_ID, SWAP_ID, { kind: 'approve' });

      expect(result.deckId).toBe(DECK_ID);
      expect(result.swap.status).toBe('approved');
      expect(result.rows.map((r) => r.id)).toEqual([SWAP_ID, 'other-id']);
      expect(result.rows[0]?.ownedCount).toBe(2);
      expect(txSwapRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { trackedDeckId: DECK_ID, userId: USER_ID } }),
      );
    });

    it('reports a restored row as retired when the recompute retires it again', async () => {
      txSwapRepo.findOne.mockResolvedValue(makeEntity({ status: 'rejected', rejectedAt: new Date() }));
      txSwapRepo.find.mockResolvedValue([makeEntity({ status: 'retired' })]);

      const result = await service.mutate(USER_ID, SWAP_ID, { kind: 'restore' });

      expect(result.swap.status).toBe('retired');
      expect(result.rows).toEqual([]);
    });

    it('skips both the write and the recompute on a no-op but still returns the rows', async () => {
      txSwapRepo.findOne.mockResolvedValue(makeEntity({ status: 'approved', appliedAt: new Date() }));
      txSwapRepo.find.mockResolvedValue([makeEntity({ status: 'approved', appliedAt: new Date() })]);

      const result = await service.mutate(USER_ID, SWAP_ID, { kind: 'approve' });

      expect(txSwapRepo.update).not.toHaveBeenCalled();
      expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
      expect(result.rows).toHaveLength(1);
    });

    it('records an outcome without recomputing readiness', async () => {
      txSwapRepo.findOne.mockResolvedValue(makeEntity({ status: 'approved', appliedAt: new Date() }));
      txSwapRepo.find.mockResolvedValue([makeEntity({ status: 'approved', outcome: 'worked' })]);

      await service.mutate(USER_ID, SWAP_ID, { kind: 'outcome', outcome: 'worked' });

      expect(txSwapRepo.update).toHaveBeenCalledWith(SWAP_ID, { outcome: 'worked' });
      expect(substitutionService.computeAndStoreReadiness).not.toHaveBeenCalled();
    });

    it('propagates a recompute failure so the transaction rolls back', async () => {
      txSwapRepo.findOne.mockResolvedValue(makeEntity());
      substitutionService.computeAndStoreReadiness.mockRejectedValue(new Error('catalog exploded'));

      await expect(service.mutate(USER_ID, SWAP_ID, { kind: 'approve' })).rejects.toThrow('catalog exploded');
    });
  });

  describe('list', () => {
    it('returns an empty list without querying swaps when the user has no decks', async () => {
      trackedDeckRepo.find.mockResolvedValue([]);

      const rows = await service.list(USER_ID, 'pending');

      expect(rows).toEqual([]);
      expect(swapRepo.find).not.toHaveBeenCalled();
    });

    it('filters by the requested status, scoped to the user', async () => {
      swapRepo.find.mockResolvedValue([makeEntity({ status: 'rejected' })]);

      const rows = await service.list(USER_ID, 'rejected');

      expect(swapRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_ID, status: 'rejected' }),
        }),
      );
      expect(rows.map((r) => r.status)).toEqual(['rejected']);
    });

    it('never returns retired rows, even for the all state', async () => {
      swapRepo.find.mockResolvedValue([
        makeEntity({ id: 'a', status: 'pending' }),
        makeEntity({ id: 'b', status: 'retired' }),
        makeEntity({ id: 'c', status: 'approved' }),
      ]);

      const rows = await service.list(USER_ID, 'all');

      expect(rows.map((r) => r.id)).toEqual(['a', 'c']);
    });

    it('annotates each row with the live owned count and its deck meta', async () => {
      swapRepo.find.mockResolvedValue([makeEntity()]);

      const [row] = await service.list(USER_ID, 'pending');

      expect(row?.ownedCount).toBe(2);
      expect(row?.deckName).toBe('Deck');
      expect(collectionReadService.loadOwned).toHaveBeenCalledWith(USER_ID);
    });
  });
});
