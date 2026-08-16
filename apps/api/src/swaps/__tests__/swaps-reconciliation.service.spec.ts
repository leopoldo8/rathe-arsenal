import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { IReadinessBreakdown, ISubstitutedEntry } from '@rathe-arsenal/engine';
import { SwapSuggestionEntity } from '../../database/entities/swap-suggestion.entity';
import { SwapsReconciliationService } from '../swaps-reconciliation.service';

function makeEntry(cardIdentifier: string, slot: string, substituteIdentifier: string): ISubstitutedEntry {
  return {
    original: {
      cardIdentifier,
      name: cardIdentifier,
      quantity: 1,
      slot,
      pitch: 1,
      cost: 1,
      type: 'Action',
      imageUrl: null,
    },
    match: {
      substitute: { cardIdentifier: substituteIdentifier, name: substituteIdentifier } as ISubstitutedEntry['match']['substitute'],
      tier: 1,
      score: 1,
      rationale: 'test rationale',
    },
    approved: false,
  };
}

function makeBreakdown(substituted: readonly ISubstitutedEntry[]): IReadinessBreakdown {
  return { exact: [], substituted, missing: [], notOwned: [] };
}

describe('SwapsReconciliationService', () => {
  let service: SwapsReconciliationService;
  let repo: jest.Mocked<Repository<SwapSuggestionEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwapsReconciliationService,
        {
          provide: getRepositoryToken(SwapSuggestionEntity),
          useValue: createMock<Repository<SwapSuggestionEntity>>(),
        },
      ],
    }).compile();

    service = module.get(SwapsReconciliationService);
    repo = module.get(getRepositoryToken(SwapSuggestionEntity));
  });

  it('inserts a new pending row for a fresh group with no persisted match', async () => {
    repo.find.mockResolvedValue([]);
    repo.create.mockImplementation((input) => input as SwapSuggestionEntity);

    await service.reconcile(
      'user-1',
      42,
      makeBreakdown([makeEntry('orig', 'mainboard', 'sub')]),
      new Set(['orig::mainboard']),
    );

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        trackedDeckId: 42,
        cardIdentifier: 'orig',
        slot: 'mainboard',
        substituteIdentifier: 'sub',
        quantity: 1,
        status: 'pending',
        appliedAt: null,
      }),
    );
    expect(repo.save).toHaveBeenCalled();
  });

  it('updates an existing pending row in place, refreshing display fields', async () => {
    repo.find.mockResolvedValue([
      {
        id: 'row-1',
        cardIdentifier: 'orig',
        slot: 'mainboard',
        substituteIdentifier: 'sub',
        status: 'pending',
      } as SwapSuggestionEntity,
    ]);

    await service.reconcile(
      'user-1',
      42,
      makeBreakdown([makeEntry('orig', 'mainboard', 'sub')]),
      new Set(['orig::mainboard']),
    );

    expect(repo.update).toHaveBeenCalledWith(
      'row-1',
      expect.objectContaining({ quantity: 1, tier: 1 }),
    );
    // A still-pending row does not get a status write.
    expect(repo.update).toHaveBeenCalledWith('row-1', expect.not.objectContaining({ status: expect.anything() }));
  });

  it('flips a retired row back to pending when the same quadruple reappears', async () => {
    repo.find.mockResolvedValue([
      {
        id: 'row-1',
        cardIdentifier: 'orig',
        slot: 'mainboard',
        substituteIdentifier: 'sub',
        status: 'retired',
      } as SwapSuggestionEntity,
    ]);

    await service.reconcile(
      'user-1',
      42,
      makeBreakdown([makeEntry('orig', 'mainboard', 'sub')]),
      new Set(['orig::mainboard']),
    );

    expect(repo.update).toHaveBeenCalledWith('row-1', expect.objectContaining({ status: 'pending' }));
  });

  it('never touches the status field of an approved row it refreshes', async () => {
    repo.find.mockResolvedValue([
      {
        id: 'row-1',
        cardIdentifier: 'orig',
        slot: 'mainboard',
        substituteIdentifier: 'sub',
        status: 'approved',
      } as SwapSuggestionEntity,
    ]);

    await service.reconcile(
      'user-1',
      42,
      makeBreakdown([makeEntry('orig', 'mainboard', 'sub')]),
      new Set(['orig::mainboard']),
    );

    expect(repo.update).toHaveBeenCalledWith('row-1', expect.not.objectContaining({ status: expect.anything() }));
  });

  it('retires a row whose position has left the deck', async () => {
    repo.find.mockResolvedValue([
      {
        id: 'row-1',
        cardIdentifier: 'gone',
        slot: 'mainboard',
        substituteIdentifier: 'sub',
        status: 'pending',
      } as SwapSuggestionEntity,
    ]);

    await service.reconcile('user-1', 42, makeBreakdown([]), new Set());

    expect(repo.update).toHaveBeenCalledWith('row-1', { status: 'retired' });
  });

  it('never issues a delete -- retire and update are the only writes to an existing row', async () => {
    repo.find.mockResolvedValue([
      {
        id: 'row-1',
        cardIdentifier: 'gone',
        slot: 'mainboard',
        substituteIdentifier: 'sub',
        status: 'pending',
      } as SwapSuggestionEntity,
    ]);

    await service.reconcile('user-1', 42, makeBreakdown([]), new Set());

    expect(repo.delete).not.toHaveBeenCalled();
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('writes through the transaction manager when one is supplied instead of the injected repository', async () => {
    const managerRepo = createMock<Repository<SwapSuggestionEntity>>();
    managerRepo.find.mockResolvedValue([]);
    managerRepo.create.mockImplementation((input) => input as SwapSuggestionEntity);
    const manager = { getRepository: jest.fn().mockReturnValue(managerRepo) };

    await service.reconcile(
      'user-1',
      42,
      makeBreakdown([makeEntry('orig', 'mainboard', 'sub')]),
      new Set(['orig::mainboard']),
      manager as never,
    );

    expect(manager.getRepository).toHaveBeenCalled();
    expect(managerRepo.save).toHaveBeenCalled();
    expect(repo.find).not.toHaveBeenCalled();
  });
});
