import { HttpException, Logger } from '@nestjs/common';
import { createMock } from '@golevelup/ts-jest';
import { catalog, findAlternatives, IReadinessBreakdown } from '@rathe-arsenal/engine';
import { Repository } from 'typeorm';
import { CollectionReadService } from '../../collection/collection-read.service';
import { CardReplacementEntity } from '../../database/entities/card-replacement.entity';
import { CollectionCardEntity } from '../../database/entities/collection-card.entity';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { StoreEntity } from '../../database/entities/store.entity';
import { StoreStockEntity } from '../../database/entities/store-stock.entity';
import { StoreStockVariantEntity } from '../../database/entities/store-stock-variant.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { DeckReadinessSnapshotEntity } from '../../database/entities/deck-readiness-snapshot.entity';
import { ShoppingLineService } from '../../stores/shopping-line.service';
import { SubstitutionService } from '../../substitution/substitution.service';
import { SwapSuggestionQueryService } from '../../swaps/swap-suggestion-query.service';
import { AlternativesService } from '../alternatives.service';
import { ReplacementsQueryService } from '../replacements-query.service';
import { RecommendationsQueryService } from '../../recommendations/recommendations-query.service';

const USER_ID = 'user-1';
const DECK_ID = 9;
const EMISSARY = 'emissary-of-tides-red';
const COAX = 'coax-a-commotion-red';

function notOwned(cardIdentifier: string, quantity: number, slot = 'mainboard'): IReadinessBreakdown['notOwned'][number] {
  return { cardIdentifier, quantity, slot } as IReadinessBreakdown['notOwned'][number];
}

function replacement(cardIdentifier: string, quantity: number): CardReplacementEntity {
  return {
    id: 'r1',
    slot: 'mainboard',
    originalCardIdentifier: EMISSARY,
    replacementCardIdentifier: cardIdentifier,
    quantity,
    status: 'active',
  } as CardReplacementEntity;
}

function deckRow(cardIdentifier: string, quantity: number, slot = 'mainboard'): DeckCardEntity {
  return { id: 1, trackedDeckId: DECK_ID, cardIdentifier, quantity, slot } as DeckCardEntity;
}

function store(): StoreEntity {
  return { id: 1, slug: 'cupula-dt', name: 'Cúpula DT', baseUrl: 'https://www.cupuladt.com.br', active: true } as StoreEntity;
}

function stock(cardIdentifier: string, overrides: Partial<StoreStockEntity> = {}): StoreStockEntity {
  return {
    id: 1,
    storeId: 1,
    cardIdentifier,
    priceCents: 350,
    quantity: 5,
    productUrl: `https://www.cupuladt.com.br/item/${cardIdentifier}`,
    lastFetchedAt: new Date('2026-10-01T10:00:00Z'),
    ...overrides,
  } as StoreStockEntity;
}

function variant(cardIdentifier: string, priceCents: number, overrides: Partial<StoreStockVariantEntity> = {}): StoreStockVariantEntity {
  return {
    id: 1,
    storeId: 1,
    cardIdentifier,
    edition: 'MST',
    condition: 'NM',
    finish: 'non-foil',
    priceCents,
    quantity: 4,
    listingPriceCentsSnapshot: 350,
    listingQuantitySnapshot: 5,
    ...overrides,
  } as StoreStockVariantEntity;
}

interface IHarness {
  readonly service: AlternativesService;
  readonly substitution: jest.Mocked<SubstitutionService>;
  readonly replacements: jest.Mocked<ReplacementsQueryService>;
  readonly shopping: ShoppingLineService;
  setDeckCards(rows: DeckCardEntity[]): void;
  setOwned(rows: Array<{ cardIdentifier: string; quantity: number; active: boolean }>): void;
  setStore(rows: { store: StoreEntity | null; stock: StoreStockEntity[]; variants: StoreStockVariantEntity[] }): void;
  failStoreQueries(error: Error): void;
}

function harness(): IHarness {
  const trackedDecks = createMock<Repository<TrackedDeckEntity>>();
  trackedDecks.findOne.mockResolvedValue({
    id: DECK_ID,
    userId: USER_ID,
    heroIdentifier: 'katsu-the-wanderer',
    format: 'Classic Constructed',
  } as TrackedDeckEntity);
  const deckCards = createMock<Repository<DeckCardEntity>>();
  deckCards.find.mockResolvedValue([deckRow(EMISSARY, 2)]);

  const substitution = createMock<SubstitutionService>();
  substitution.computeReadinessWithExclusions.mockResolvedValue({
    breakdown: { notOwned: [notOwned(EMISSARY, 2)] },
  } as never);
  const swaps = createMock<SwapSuggestionQueryService>();
  swaps.loadReadinessInputs.mockResolvedValue({ excludedIdentifiers: new Set(), approvedIdentifiers: new Set() });
  const replacements = createMock<ReplacementsQueryService>();
  replacements.loadActive.mockResolvedValue([]);

  let ownedRows: Array<{ cardIdentifier: string; quantity: number; active: boolean }> = [];
  const csvSources = createMock<Repository<CsvSourceEntity>>();
  csvSources.find.mockResolvedValue([{ id: 'active-source' } as CsvSourceEntity]);
  const collectionCards = createMock<Repository<CollectionCardEntity>>();
  collectionCards.find.mockImplementation((async () =>
    ownedRows.filter((row) => row.active).map((row) => ({ cardIdentifier: row.cardIdentifier, quantity: row.quantity }))) as never);
  const collection = new CollectionReadService(collectionCards, csvSources);

  const storeRepo = createMock<Repository<StoreEntity>>();
  storeRepo.findOne.mockResolvedValue(store());
  const stockRepo = createMock<Repository<StoreStockEntity>>();
  stockRepo.find.mockResolvedValue([]);
  const variantRepo = createMock<Repository<StoreStockVariantEntity>>();
  variantRepo.find.mockResolvedValue([]);
  const shopping = new ShoppingLineService(
    storeRepo,
    stockRepo,
    variantRepo,
    createMock<Repository<TrackedDeckEntity>>(),
    createMock<Repository<DeckReadinessSnapshotEntity>>(),
  );

  const recommendations = createMock<RecommendationsQueryService>();
  recommendations.latestDoneRuns.mockResolvedValue(new Map());

  return {
    service: new AlternativesService(trackedDecks, deckCards, substitution, swaps, replacements, collection, shopping, recommendations),
    substitution,
    replacements,
    shopping,
    setDeckCards: (rows) => deckCards.find.mockResolvedValue(rows),
    setOwned: (rows) => {
      ownedRows = rows;
    },
    failStoreQueries: (error) => {
      storeRepo.findOne.mockRejectedValue(error);
    },
    setStore: ({ store: found, stock: stockRows, variants }) => {
      storeRepo.findOne.mockResolvedValue(found);
      stockRepo.find.mockResolvedValue(stockRows);
      variantRepo.find.mockResolvedValue(variants);
    },
  };
}

const request = { userId: USER_ID, deckId: DECK_ID, cardIdentifier: EMISSARY, slot: 'mainboard' };

describe('AlternativesService', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("needed is the slot's not-owned copies minus protected copies", async () => {
    const h = harness();
    expect((await h.service.list(request)).needed).toBe(2);

    h.substitution.computeReadinessWithExclusions.mockResolvedValue({
      breakdown: { notOwned: [notOwned(EMISSARY, 1)] },
    } as never);
    expect((await h.service.list(request)).needed).toBe(1);

    // One active replacement holds both copies of coax, none owned: nothing is left to replace.
    h.substitution.computeReadinessWithExclusions.mockResolvedValue({
      breakdown: { notOwned: [notOwned(COAX, 2)] },
    } as never);
    h.replacements.loadActive.mockResolvedValue([replacement(COAX, 2)]);
    await expect(h.service.list({ ...request, cardIdentifier: COAX })).rejects.toMatchObject({
      response: { code: 'NOTHING_TO_REPLACE' },
    });
  });

  it('a slot split across two notOwned entries is not mixed with another slot', async () => {
    const h = harness();
    h.substitution.computeReadinessWithExclusions.mockResolvedValue({
      breakdown: { notOwned: [notOwned(EMISSARY, 2, 'mainboard'), notOwned(EMISSARY, 1, 'equipment')] },
    } as never);

    expect((await h.service.list(request)).needed).toBe(2);
  });

  describe('freeCopies', () => {
    async function freeCopiesOfFirstCard(h: IHarness): Promise<{ id: string; free: number }> {
      const first = (await h.service.list(request)).groups[0]!.cards[0]!;
      return { id: first.cardIdentifier, free: first.freeCopies };
    }

    function firstCandidate(): string {
      const emissary = catalog.getCard(EMISSARY);
      const groups = findAlternatives(
        {
          missing: emissary,
          needed: 2,
          heroCard: catalog.getCard('katsu-the-wanderer'),
          format: 'Classic Constructed',
          deckCopies: new Map([[EMISSARY, 2]]),
          owned: new Map(),
        },
        catalog,
      );
      return groups[0]!.cards[0]!.card.cardIdentifier;
    }

    it("freeCopies subtracts this deck's copies", async () => {
      const candidate = firstCandidate();
      const h = harness();
      h.setOwned([{ cardIdentifier: candidate, quantity: 3, active: true }]);
      h.setDeckCards([deckRow(EMISSARY, 2), deckRow(candidate, 1)]);

      const owned3 = await h.service.list(request);
      expect(owned3.groups.flatMap((g) => g.cards).find((c) => c.cardIdentifier === candidate)?.freeCopies).toBe(2);

      // One missing copy, so two copies of the candidate in the deck still fit the copy limit.
      h.substitution.computeReadinessWithExclusions.mockResolvedValue({
        breakdown: { notOwned: [notOwned(EMISSARY, 1)] },
      } as never);
      h.setOwned([{ cardIdentifier: candidate, quantity: 1, active: true }]);
      h.setDeckCards([deckRow(EMISSARY, 2), deckRow(candidate, 2)]);
      const floored = await h.service.list(request);
      expect(floored.groups.flatMap((g) => g.cards).find((c) => c.cardIdentifier === candidate)?.freeCopies).toBe(0);
    });

    it("freeCopies subtracts this deck's copies: a card in two slots counts both", async () => {
      const candidate = firstCandidate();
      const h = harness();
      h.substitution.computeReadinessWithExclusions.mockResolvedValue({
        breakdown: { notOwned: [notOwned(EMISSARY, 1)] },
      } as never);
      h.setOwned([{ cardIdentifier: candidate, quantity: 3, active: true }]);
      h.setDeckCards([deckRow(EMISSARY, 2), deckRow(candidate, 1, 'mainboard'), deckRow(candidate, 1, 'equipment')]);

      const res = await h.service.list(request);

      expect(res.groups.flatMap((g) => g.cards).find((c) => c.cardIdentifier === candidate)?.freeCopies).toBe(1);
    });

    it("freeCopies subtracts this deck's copies: the copy limit counts a card in two slots", async () => {
      const candidate = firstCandidate();
      const h = harness();
      // Two missing copies and two held in different slots: 2 + 2 is over the limit of 3.
      h.setDeckCards([deckRow(EMISSARY, 2), deckRow(candidate, 1, 'mainboard'), deckRow(candidate, 1, 'equipment')]);

      const res = await h.service.list(request);

      expect(res.groups.flatMap((g) => g.cards).some((c) => c.cardIdentifier === candidate)).toBe(false);
    });

    it("freeCopies subtracts this deck's copies: copies in an inactive source do not count", async () => {
      const candidate = firstCandidate();
      const h = harness();
      h.setOwned([
        { cardIdentifier: candidate, quantity: 1, active: true },
        { cardIdentifier: candidate, quantity: 5, active: false },
      ]);

      const res = await h.service.list(request);

      expect(res.groups.flatMap((g) => g.cards).find((c) => c.cardIdentifier === candidate)?.freeCopies).toBe(1);
      await expect(freeCopiesOfFirstCard(h)).resolves.toBeDefined();
    });
  });

  describe('prices', () => {
    it('prices match the shopping line on both paths', async () => {
      const h = harness();
      const baseline = (await h.service.list(request)).groups[0]!.cards;
      const [listingCard, variantCard] = [baseline[0]!.cardIdentifier, baseline[1]!.cardIdentifier];
      h.setStore({
        store: store(),
        stock: [stock(listingCard), stock(variantCard)],
        variants: [variant(variantCard, 35), variant(variantCard, 90, { edition: 'HVY' })],
      });

      const res = await h.service.list(request);
      const priced = new Map(res.groups.flatMap((g) => g.cards).map((c) => [c.cardIdentifier, c] as const));

      const line = await h.shopping.computeForBreakdown({
        exact: [],
        substituted: [],
        notOwned: [],
        missing: [listingCard, variantCard].map((cardIdentifier) => ({ cardIdentifier, quantity: 2 })),
      } as never);
      if (line?.kind !== 'populated') throw new Error('expected a populated shopping line');
      const lines = new Map(line.lines.map((entry) => [entry.cardIdentifier, entry] as const));

      expect(lines.get(listingCard)!.dataSource).toBe('listing');
      expect(lines.get(variantCard)!.dataSource).toBe('variant');
      expect(priced.get(listingCard)).toEqual(
        expect.objectContaining({ priceCents: 350, productUrl: lines.get(listingCard)!.productUrl }),
      );
      expect(priced.get(variantCard)).toEqual(
        expect.objectContaining({ priceCents: 35, productUrl: lines.get(variantCard)!.productUrl }),
      );
      expect(priced.get(variantCard)!.priceCents).toBe(lines.get(variantCard)!.unitPriceCents);
    });

    it('lists out-of-stock cards with null price', async () => {
      const h = harness();
      const cards = (await h.service.list(request)).groups[0]!.cards.map((c) => c.cardIdentifier);
      const [noRow, zeroQuantity, nullPrice, control] = cards;

      h.setStore({
        store: store(),
        stock: [
          stock(zeroQuantity!, { quantity: 0 }),
          stock(nullPrice!, { priceCents: null as unknown as number }),
          stock(control!),
        ],
        variants: [],
      });
      const res = await h.service.list(request);
      const byId = new Map(res.groups.flatMap((g) => g.cards).map((c) => [c.cardIdentifier, c] as const));

      for (const id of [noRow!, zeroQuantity!, nullPrice!]) {
        expect(byId.get(id)).toEqual(expect.objectContaining({ priceCents: null, productUrl: null }));
      }
      expect(byId.get(control!)!.priceCents).toBe(350);

      h.setStore({ store: null, stock: [], variants: [] });
      const noStore = await h.service.list(request);
      const listed = noStore.groups.flatMap((g) => g.cards);
      expect(listed.length).toBeGreaterThan(0);
      expect(listed.every((c) => c.priceCents === null && c.productUrl === null)).toBe(true);
    });

    it('lists out-of-stock cards with null price: a failing store query still lists every card, with a warning', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const h = harness();
      const expected = (await h.service.list(request)).groups.flatMap((g) => g.cards.map((c) => c.cardIdentifier));
      h.failStoreQueries(new Error('store down'));

      const res = await h.service.list(request);

      const listed = res.groups.flatMap((g) => g.cards);
      expect(listed.map((c) => c.cardIdentifier)).toEqual(expected);
      expect(listed.every((c) => c.priceCents === null && c.productUrl === null)).toBe(true);
      expect(warn).toHaveBeenCalledWith(expect.objectContaining({ msg: 'Alternatives price lookup failed', error: 'store down' }));
      warn.mockRestore();
    });

    it('lists out-of-stock cards with null price: variant rows that are all out of stock', async () => {
      const h = harness();
      const first = (await h.service.list(request)).groups[0]!.cards[0]!.cardIdentifier;
      h.setStore({ store: store(), stock: [stock(first)], variants: [variant(first, 35, { quantity: 0 })] });

      const res = await h.service.list(request);

      expect(res.groups.flatMap((g) => g.cards).find((c) => c.cardIdentifier === first)).toEqual(
        expect.objectContaining({ priceCents: null, productUrl: null }),
      );
    });
  });

  it('logs alternatives.listed once per answered request', async () => {
    const h = harness();

    const res = await h.service.list({ ...request, query: 'sink' });

    const listed = logSpy.mock.calls.filter(([entry]) => (entry as { event?: string }).event === 'alternatives.listed');
    expect(listed).toHaveLength(1);
    expect(listed[0]![0]).toEqual({
      event: 'alternatives.listed',
      userId: USER_ID,
      trackedDeckId: DECK_ID,
      cardIdentifier: EMISSARY,
      slot: 'mainboard',
      needed: 2,
      groupCounts: { search: res.groups[0]!.cards.length },
      hasQuery: true,
    });

    // Without a name search the same line says so.
    logSpy.mockClear();
    const plain = await h.service.list(request);
    const plainLogs = logSpy.mock.calls.filter(([entry]) => (entry as { event?: string }).event === 'alternatives.listed');
    expect(plainLogs).toHaveLength(1);
    expect(plainLogs[0]![0]).toEqual(
      expect.objectContaining({
        hasQuery: false,
        groupCounts: Object.fromEntries(plain.groups.map((group) => [group.group, group.cards.length])),
      }),
    );

    logSpy.mockClear();
    h.substitution.computeReadinessWithExclusions.mockResolvedValue({ breakdown: { notOwned: [] } } as never);
    await expect(h.service.list(request)).rejects.toBeInstanceOf(HttpException);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
