import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { EntityManager, Repository } from 'typeorm';
import { buildExclusionKey } from '@rathe-arsenal/engine';
import { SwapSuggestionEntity } from '../../database/entities/swap-suggestion.entity';
import { SwapSuggestionQueryService } from '../swap-suggestion-query.service';

describe('SwapSuggestionQueryService', () => {
  let service: SwapSuggestionQueryService;
  let repo: jest.Mocked<Repository<SwapSuggestionEntity>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SwapSuggestionQueryService,
        {
          provide: getRepositoryToken(SwapSuggestionEntity),
          useValue: createMock<Repository<SwapSuggestionEntity>>(),
        },
      ],
    }).compile();

    service = module.get(SwapSuggestionQueryService);
    repo = module.get(getRepositoryToken(SwapSuggestionEntity));
  });

  it('partitions rejected rows into excludedIdentifiers and approved rows into approvedIdentifiers', async () => {
    repo.find.mockResolvedValue([
      { cardIdentifier: 'orig-a', slot: 'mainboard', substituteIdentifier: 'sub-a', status: 'rejected' },
      { cardIdentifier: 'orig-b', slot: 'mainboard', substituteIdentifier: 'sub-b', status: 'approved' },
    ] as SwapSuggestionEntity[]);

    const { excludedIdentifiers, approvedIdentifiers } = await service.loadReadinessInputs(42);

    expect(excludedIdentifiers).toEqual(
      new Set([buildExclusionKey('orig-a', 'mainboard', 'sub-a')]),
    );
    expect(approvedIdentifiers).toEqual(
      new Set([buildExclusionKey('orig-b', 'mainboard', 'sub-b')]),
    );
  });

  it('queries only rejected and approved rows for the given deck', async () => {
    repo.find.mockResolvedValue([]);

    await service.loadReadinessInputs(42);

    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ trackedDeckId: 42 }),
      }),
    );
  });

  it('reads through the caller-supplied transaction manager so uncommitted writes are visible', async () => {
    const txRepo = createMock<Repository<SwapSuggestionEntity>>();
    txRepo.find.mockResolvedValue([
      { cardIdentifier: 'orig-a', slot: 'mainboard', substituteIdentifier: 'sub-a', status: 'approved' },
    ] as SwapSuggestionEntity[]);
    const manager = createMock<EntityManager>();
    manager.getRepository.mockReturnValue(txRepo as never);

    const { approvedIdentifiers } = await service.loadReadinessInputs(42, manager);

    expect(manager.getRepository).toHaveBeenCalledWith(SwapSuggestionEntity);
    expect(repo.find).not.toHaveBeenCalled();
    expect(approvedIdentifiers).toEqual(new Set([buildExclusionKey('orig-a', 'mainboard', 'sub-a')]));
  });

  it('returns empty sets when the deck has no rejected/approved rows', async () => {
    repo.find.mockResolvedValue([]);

    const { excludedIdentifiers, approvedIdentifiers } = await service.loadReadinessInputs(42);

    expect(excludedIdentifiers.size).toBe(0);
    expect(approvedIdentifiers.size).toBe(0);
  });
});
