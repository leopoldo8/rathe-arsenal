/**
 * DecksService.getDetail lists the deck's active replacements with a derived
 * `originalOwned` (card-alternatives, S3). The collection read goes through the
 * real CollectionReadService over in-memory repositories, so the active-source
 * rule is exercised rather than assumed.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { createMock } from '@golevelup/ts-jest';
import { DataSource, In, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { CardReplacementEntity } from '../../database/entities/card-replacement.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { AuthzService } from '../../auth/authz.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { ShoppingLineService } from '../../stores/shopping-line.service';
import { CatalogService } from '../../catalog/catalog.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { SwapSuggestionQueryService } from '../../swaps/swap-suggestion-query.service';
import { SwapsReconciliationService } from '../../swaps/swaps-reconciliation.service';
import { ReplacementsQueryService } from '../../replacements/replacements-query.service';
import { DecksService } from '../decks.service';

const USER_ID = 'user-uuid-replacements';
const DECK_ID = 3;
const ORIGINAL = 'emissary-of-tides-red';
const REPLACEMENT = 'coax-a-commotion-red';
const ACTIVE_SOURCE = 1;
const INACTIVE_SOURCE = 2;

interface IOwnedRow {
  readonly cardIdentifier: string;
  readonly quantity: number;
  readonly sourceId: number;
}

function deckCard(cardIdentifier: string, quantity: number, slot: string): DeckCardEntity {
  return { id: 1, trackedDeckId: DECK_ID, cardIdentifier, quantity, slot } as DeckCardEntity;
}

function activeReplacement(quantity: number): CardReplacementEntity {
  return {
    id: 'replacement-1',
    userId: USER_ID,
    trackedDeckId: DECK_ID,
    slot: 'mainboard',
    originalCardIdentifier: ORIGINAL,
    replacementCardIdentifier: REPLACEMENT,
    quantity,
    pickedFrom: 'very_close',
    status: 'active',
    createdAt: new Date('2026-10-04T10:00:00Z'),
    resolvedAt: null,
  } as CardReplacementEntity;
}

describe('DecksService.getDetail replacements', () => {
  let service: DecksService;
  let deckCardRepo: jest.Mocked<Repository<DeckCardEntity>>;
  let replacementsQueryService: jest.Mocked<ReplacementsQueryService>;
  let catalogService: jest.Mocked<CatalogService>;
  let ownedRows: IOwnedRow[];

  beforeEach(async () => {
    const trackedDeckRepo = createMock<Repository<TrackedDeckEntity>>();
    trackedDeckRepo.findOne.mockResolvedValue({
      id: DECK_ID,
      userId: USER_ID,
      name: 'Replacements deck',
      hero: 'Katsu, the Wanderer',
      heroIdentifier: 'katsu-the-wanderer',
      format: 'Classic Constructed',
      status: 'building',
      notes: null,
      fabraryUlid: null,
      trackedAt: new Date('2026-10-01T10:00:00Z'),
      updatedAt: new Date('2026-10-01T10:00:00Z'),
    } as TrackedDeckEntity);
    deckCardRepo = createMock<Repository<DeckCardEntity>>();
    const snapshotRepo = createMock<Repository<DeckReadinessSnapshotEntity>>();
    snapshotRepo.findOne.mockResolvedValue(null);
    const substitutionService = createMock<SubstitutionService>();
    substitutionService.computeAndStoreReadiness.mockRejectedValue(new Error('not needed'));
    const shoppingLineService = createMock<ShoppingLineService>();
    const swapSuggestionQueryService = createMock<SwapSuggestionQueryService>();
    swapSuggestionQueryService.loadReadinessInputs.mockResolvedValue({
      excludedIdentifiers: new Set(),
      approvedIdentifiers: new Set(),
    });
    const dataSource = createMock<DataSource>();
    (dataSource.query as jest.Mock).mockResolvedValue([]);
    replacementsQueryService = createMock<ReplacementsQueryService>();
    catalogService = createMock<CatalogService>();
    catalogService.getCard.mockImplementation(((id: string) => {
      const names: Record<string, string> = { [ORIGINAL]: 'Emissary of Tides', 'a-moments-peace-blue': "A Moment's Peace" };
      if (!(id in names)) throw new Error('not in catalog');
      return { name: names[id] };
    }) as never);

    ownedRows = [];
    const csvSourceRepo = createMock<Repository<CsvSourceEntity>>();
    csvSourceRepo.find.mockResolvedValue([{ id: ACTIVE_SOURCE } as unknown as CsvSourceEntity]);
    const collectionCardRepo = createMock<Repository<CollectionCardEntity>>();
    collectionCardRepo.find.mockImplementation((async (options: {
      where: { sourceId: ReturnType<typeof In<number>>; cardIdentifier?: ReturnType<typeof In<string>> };
    }) => {
      const sourceIds = (options.where.sourceId as unknown as { value: number[] }).value;
      const identifiers = (options.where.cardIdentifier as unknown as { value: string[] } | undefined)?.value;
      return ownedRows.filter(
        (row) => sourceIds.includes(row.sourceId) && (identifiers === undefined || identifiers.includes(row.cardIdentifier)),
      );
    }) as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DecksService,
        { provide: getRepositoryToken(TrackedDeckEntity), useValue: trackedDeckRepo },
        { provide: getRepositoryToken(DeckCardEntity), useValue: deckCardRepo },
        { provide: getRepositoryToken(DeckReadinessSnapshotEntity), useValue: snapshotRepo },
        { provide: getRepositoryToken(CsvSourceEntity), useValue: csvSourceRepo },
        { provide: getRepositoryToken(CollectionCardEntity), useValue: collectionCardRepo },
        CollectionReadService,
        { provide: DataSource, useValue: dataSource },
        { provide: AuthzService, useValue: createMock<AuthzService>() },
        { provide: SubstitutionService, useValue: substitutionService },
        { provide: ShoppingLineService, useValue: shoppingLineService },
        { provide: CatalogService, useValue: catalogService },
        { provide: SwapSuggestionQueryService, useValue: swapSuggestionQueryService },
        { provide: SwapsReconciliationService, useValue: createMock<SwapsReconciliationService>() },
        { provide: ReplacementsQueryService, useValue: replacementsQueryService },
      ],
    }).compile();

    service = module.get(DecksService);
  });

  async function originalOwned(
    quantity: number,
    owned: readonly IOwnedRow[],
    deckCards: readonly DeckCardEntity[] = [],
  ): Promise<boolean> {
    ownedRows = [...owned];
    deckCardRepo.find.mockResolvedValue([deckCard(REPLACEMENT, quantity, 'mainboard'), ...deckCards]);
    replacementsQueryService.loadActive.mockResolvedValue([activeReplacement(quantity)]);

    const detail = await service.getDetail(USER_ID, DECK_ID);

    expect(detail.replacements).toHaveLength(1);
    return detail.replacements[0]!.originalOwned;
  }

  it('originalOwned compares free copies with the quantity: owning every replaced copy is true', async () => {
    expect(await originalOwned(2, [{ cardIdentifier: ORIGINAL, quantity: 2, sourceId: ACTIVE_SOURCE }])).toBe(true);
  });

  it('originalOwned compares free copies with the quantity: owning one copy short is false', async () => {
    expect(await originalOwned(2, [{ cardIdentifier: ORIGINAL, quantity: 1, sourceId: ACTIVE_SOURCE }])).toBe(false);
  });

  it('originalOwned compares free copies with the quantity: copies already in another slot of this deck do not count', async () => {
    const owned = [{ cardIdentifier: ORIGINAL, quantity: 3, sourceId: ACTIVE_SOURCE }];

    expect(await originalOwned(2, owned, [deckCard(ORIGINAL, 2, 'equipment')])).toBe(false);
    expect(await originalOwned(2, owned, [deckCard(ORIGINAL, 1, 'equipment')])).toBe(true);
  });

  it('originalOwned compares free copies with the quantity: copies in an inactive source do not count', async () => {
    const owned = [
      { cardIdentifier: ORIGINAL, quantity: 1, sourceId: ACTIVE_SOURCE },
      { cardIdentifier: ORIGINAL, quantity: 5, sourceId: INACTIVE_SOURCE },
    ];

    expect(await originalOwned(2, owned)).toBe(false);
  });

  it('lists exactly the documented fields of each active replacement', async () => {
    ownedRows = [];
    deckCardRepo.find.mockResolvedValue([deckCard(REPLACEMENT, 2, 'mainboard')]);
    replacementsQueryService.loadActive.mockResolvedValue([activeReplacement(2)]);

    const detail = await service.getDetail(USER_ID, DECK_ID);

    expect(detail.replacements).toEqual([
      {
        id: 'replacement-1',
        slot: 'mainboard',
        originalCardIdentifier: ORIGINAL,
        originalName: 'Emissary of Tides',
        replacementCardIdentifier: REPLACEMENT,
        quantity: 2,
        originalOwned: false,
      },
    ]);
  });

  it('names the original with its catalog name, punctuation included, or its identifier when the card left the catalog', async () => {
    deckCardRepo.find.mockResolvedValue([deckCard(REPLACEMENT, 2, 'mainboard')]);
    replacementsQueryService.loadActive.mockResolvedValue([
      { ...activeReplacement(1), id: 'r-punctuation', originalCardIdentifier: 'a-moments-peace-blue' },
      { ...activeReplacement(1), id: 'r-retired', originalCardIdentifier: 'retired-card-red' },
    ]);

    const detail = await service.getDetail(USER_ID, DECK_ID);

    expect(detail.replacements.map((r) => r.originalName)).toEqual(["A Moment's Peace", 'retired-card-red']);
  });

  it('lists no replacements and reads no collection when none is active', async () => {
    deckCardRepo.find.mockResolvedValue([]);
    replacementsQueryService.loadActive.mockResolvedValue([]);

    const detail = await service.getDetail(USER_ID, DECK_ID);

    expect(detail.replacements).toEqual([]);
  });
});
