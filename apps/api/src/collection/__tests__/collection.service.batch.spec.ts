import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { AuthzService } from '../../auth/authz.service';
import { CatalogService } from '../../catalog/catalog.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SwapSuggestionQueryService } from '../../swaps/swap-suggestion-query.service';
import { SourcesService } from '../sources/sources.service';
import { CollectionService } from '../collection.service';

const USER_ID = 'user-batch';
const SOURCE_ID = 'manual-source-batch';
const CARD_A = 'nimblism-red';
const CARD_B = 'crane-dance-yellow';
const DECK_WITH_A_AND_B = 1;
const DECK_WITH_B = 2;
const DECK_WITH_NEITHER = 3;

interface IQueryRow {
  readonly cardIdentifier: string;
  readonly quantity: number;
}

describe('CollectionService.addCardsBatch', () => {
  let service: CollectionService;
  let manager: jest.Mocked<EntityManager>;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let substitutionService: jest.Mocked<SubstitutionService>;
  let affectedDeckRows: { trackedDeckId: number }[];
  let deckQueryCardIds: unknown;

  function givenRows(previous: readonly IQueryRow[], updated: readonly IQueryRow[]): void {
    manager.query.mockResolvedValueOnce([...previous]).mockResolvedValueOnce([...updated]);
  }

  beforeEach(async () => {
    manager = createMock<EntityManager>();
    const dataSource = createMock<DataSource>();
    (dataSource.transaction as unknown as jest.Mock).mockImplementation(
      async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
    );

    affectedDeckRows = [{ trackedDeckId: DECK_WITH_A_AND_B }, { trackedDeckId: DECK_WITH_B }];
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation((_sql: string, params: { cardIdentifiers: unknown }) => {
        deckQueryCardIds = params.cardIdentifiers;
        return queryBuilder;
      }),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockImplementation(async () => affectedDeckRows),
    };
    deckCardRepo.createQueryBuilder.mockReturnValue(queryBuilder as never);

    substitutionService = createMock<SubstitutionService>();
    substitutionService.computeAndStoreReadiness.mockResolvedValue({
      rawPercent: 50,
      effectivePercent: 60,
    } as never);
    const swapSuggestionQueryService = createMock<SwapSuggestionQueryService>();
    swapSuggestionQueryService.loadReadinessInputs.mockResolvedValue({
      excludedIdentifiers: new Set(),
      approvedIdentifiers: new Set(),
    });
    const sourcesService = createMock<SourcesService>();
    sourcesService.ensureManualSource.mockResolvedValue({ id: SOURCE_ID } as CsvSourceEntity);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionService,
        { provide: getRepositoryToken(CollectionCardEntity), useValue: createMock<Repository<CollectionCardEntity>>() },
        { provide: getRepositoryToken(CsvSourceEntity), useValue: createMock<Repository<CsvSourceEntity>>() },
        { provide: getRepositoryToken(DeckCardEntity), useValue: deckCardRepo },
        {
          provide: getRepositoryToken(DeckReadinessSnapshotEntity),
          useValue: createMock<Repository<DeckReadinessSnapshotEntity>>(),
        },
        { provide: getRepositoryToken(TrackedDeckEntity), useValue: createMock<Repository<TrackedDeckEntity>>() },
        { provide: DataSource, useValue: dataSource },
        { provide: AuthzService, useValue: createMock<AuthzService>() },
        { provide: CatalogService, useValue: createMock<CatalogService>() },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: SwapSuggestionQueryService, useValue: swapSuggestionQueryService },
        { provide: SourcesService, useValue: sourcesService },
      ],
    }).compile();

    service = module.get(CollectionService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('recomputes each affected deck once', async () => {
    // Arrange
    givenRows([], [{ cardIdentifier: CARD_A, quantity: 1 }, { cardIdentifier: CARD_B, quantity: 1 }]);

    // Act
    const response = await service.addCardsBatch(USER_ID, [
      { cardIdentifier: CARD_A, quantity: 1 },
      { cardIdentifier: CARD_B, quantity: 1 },
    ]);

    // Assert
    const recomputedDeckIds = substitutionService.computeAndStoreReadiness.mock.calls.map(([deckId]) => deckId);
    expect(deckQueryCardIds).toEqual([CARD_A, CARD_B]);
    expect(recomputedDeckIds).toEqual([DECK_WITH_A_AND_B, DECK_WITH_B]);
    expect(recomputedDeckIds).not.toContain(DECK_WITH_NEITHER);
    expect(response.recomputedDeckCount).toBe(2);
  });

  it('survives a failed recompute', async () => {
    // Arrange
    givenRows([{ cardIdentifier: CARD_A, quantity: 1 }], [{ cardIdentifier: CARD_A, quantity: 3 }]);
    substitutionService.computeAndStoreReadiness.mockImplementation(async (deckId: number) => {
      if (deckId === DECK_WITH_A_AND_B) throw new Error('engine exploded');
      return { rawPercent: 50, effectivePercent: 60 } as never;
    });

    // Act
    const response = await service.addCardsBatch(USER_ID, [{ cardIdentifier: CARD_A, quantity: 2 }]);

    // Assert
    expect(response.results).toEqual([{ cardIdentifier: CARD_A, newQuantity: 3, capped: false }]);
    expect(substitutionService.computeAndStoreReadiness).toHaveBeenCalledWith(
      DECK_WITH_B,
      USER_ID,
      expect.anything(),
      expect.anything(),
    );
    expect(response.recomputedDeckCount).toBe(1);
  });

  it('logs the commit summary', async () => {
    // Arrange
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    affectedDeckRows = [{ trackedDeckId: DECK_WITH_B }];
    givenRows(
      [{ cardIdentifier: CARD_A, quantity: 19 }],
      [{ cardIdentifier: CARD_A, quantity: 20 }, { cardIdentifier: CARD_B, quantity: 1 }],
    );

    // Act
    await service.addCardsBatch(USER_ID, [
      { cardIdentifier: CARD_A, quantity: 2 },
      { cardIdentifier: CARD_B, quantity: 1 },
    ]);

    // Assert
    expect(logSpy).toHaveBeenCalledWith('Cards batch-added to collection', {
      userId: USER_ID,
      itemCount: 2,
      totalQuantity: 3,
      cappedCount: 1,
      affectedDeckCount: 1,
    });
  });
});
