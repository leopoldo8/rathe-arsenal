import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { ICurrentUser } from '../../../auth/dtos/current-user.dto';
import { ChatPricesService } from '../../../chat/chat-prices.service';
import { ChatToolsService } from '../../../chat/chat-tools.service';
import { CollectionReadService } from '../../collection-read.service';
import { CardListLineEntity } from '../../../database/entities/card-list-line.entity';
import { CardListEntity } from '../../../database/entities/card-list.entity';
import { CollectionCardEntity } from '../../../database/entities/collection-card.entity';
import { DeckCardEntity } from '../../../database/entities/deck-card.entity';
import { ShareLinkEntity, TDeckShareIntent } from '../../../database/entities/share-link.entity';
import { StoreStockEntity } from '../../../database/entities/store-stock.entity';
import { TrackedDeckEntity } from '../../../database/entities/tracked-deck.entity';
import { EUserRole, UserEntity } from '../../../database/entities/user.entity';
import { PriceSuggestionService } from '../../../prices/price-suggestion.service';
import { RecommendationsService } from '../../../recommendations/recommendations.service';
import { CommunityDecksService } from '../../../reference/community-decks.service';
import { RulesImportService } from '../../../reference/rules-import.service';
import { ShareEventsService } from '../../../sharing/share-events.service';
import { SharedDeckLookup } from '../../../sharing/shared-deck-lookup';
import { SharedDeckMissingService } from '../../../sharing/shared-deck-missing.service';
import { SharedDeckViewService } from '../../../sharing/shared-deck-view.service';
import { SharedGroupAskService } from '../../../sharing/shared-group-ask.service';
import { SharedListLookup } from '../../../sharing/shared-list-lookup';
import { SharedListViewService } from '../../../sharing/shared-list-view.service';
import { VisitorDecksMissingService } from '../../../sharing/visitor-decks-missing.service';
import { SharedDeckReplacements } from '../../../sharing/shared-deck-replacements';
import { SpareCopiesService } from '../spare-copies.service';
import { SpareViewService } from '../spare-view.service';

const PACK_HUNT = 'pack-hunt-blue';
const DUDA = 'duda';
const OWNER = { id: 'owner-1', displayName: 'Rodrigo', whatsappNumber: '5551999990000' } as UserEntity;

/** Duda's decks: Kayo CC 3, Rhinar CC 2 and Rhinar SA 2 of Pack Hunt (Azul), 6 owned, rule `within_format`. */
function spareService(): SpareCopiesService {
  const queryBuilder: Record<string, unknown> = {};
  for (const method of ['innerJoin', 'select', 'addSelect', 'where', 'andWhere', 'groupBy', 'having']) queryBuilder[method] = () => queryBuilder;
  queryBuilder['getRawMany'] = async () => [
    { cardIdentifier: PACK_HUNT, printingCode: '', edition: '', finish: '', condition: '', quantity: 6 },
  ];
  const collection = { createQueryBuilder: () => queryBuilder } as unknown as Repository<CollectionCardEntity>;
  const decks = createMock<Repository<TrackedDeckEntity>>();
  decks.find.mockResolvedValue([
    { id: 1, name: 'Kayo CC', format: 'Classic Constructed', status: 'building' },
    { id: 2, name: 'Rhinar CC', format: 'Classic Constructed', status: 'ready' },
    { id: 3, name: 'Rhinar SA', format: 'Silver Age', status: 'active' },
  ] as TrackedDeckEntity[]);
  const deckCards = createMock<Repository<DeckCardEntity>>();
  deckCards.find.mockResolvedValue([
    { trackedDeckId: 1, cardIdentifier: PACK_HUNT, quantity: 3, inventoryQuantity: 0 },
    { trackedDeckId: 2, cardIdentifier: PACK_HUNT, quantity: 2, inventoryQuantity: 0 },
    { trackedDeckId: 3, cardIdentifier: PACK_HUNT, quantity: 2, inventoryQuantity: 0 },
  ] as DeckCardEntity[]);
  const users = createMock<Repository<UserEntity>>();
  users.findOne.mockResolvedValue({ id: DUDA, spareRule: 'within_format' } as UserEntity);
  return new SpareCopiesService(collection, decks, deckCards, users);
}

const visitor = (userId: string): ICurrentUser => ({ userId, email: 'duda@example.com', role: EUserRole.User, chatAccess: false });
const config = (): ConfigService => {
  const mock = createMock<ConfigService>();
  mock.get.mockReturnValue('https://app.example');
  return mock;
};

async function sobrandoReader(spare: SpareCopiesService): Promise<number> {
  const prices = createMock<PriceSuggestionService>();
  prices.forVersions.mockResolvedValue(new Map());
  const storeStock = createMock<Repository<StoreStockEntity>>();
  const queryBuilder: Record<string, unknown> = {};
  for (const method of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) queryBuilder[method] = () => queryBuilder;
  queryBuilder['getRawMany'] = async () => [];
  storeStock.createQueryBuilder.mockReturnValue(queryBuilder as never);
  const response = await new SpareViewService(spare, prices, storeStock).read(DUDA);
  return response.rows.filter((row) => row.cardIdentifier === PACK_HUNT).reduce((sum, row) => sum + row.spare, 0);
}

async function wantListReader(spare: SpareCopiesService): Promise<number | null> {
  const link = { id: 1, intent: 'want', showsContact: true } as ShareLinkEntity & { intent: 'want' };
  const list = { id: 21, kind: 'want', name: 'Procuro', notes: null, totalPriceCents: null, updatedAt: new Date('2026-10-01T00:00:00Z') } as CardListEntity;
  const lookup = createMock<SharedListLookup>();
  lookup.findLive.mockResolvedValue({ link, list, owner: OWNER });
  const collection = createMock<CollectionReadService>();
  collection.loadOwned.mockResolvedValue(new Map([[PACK_HUNT, 6]]));
  const lines = createMock<Repository<CardListLineEntity>>();
  lines.find.mockResolvedValue([{ id: 1, cardIdentifier: PACK_HUNT, quantity: 2, soldAt: null, condition: null, printing: null, priceCents: null }] as CardListLineEntity[]);
  const service = new SharedListViewService(lookup, createMock<ShareEventsService>(), collection, createMock<VisitorDecksMissingService>(), config(), spare, lines);
  const page = await service.view('live', visitor(DUDA));
  return page.lines[0]?.spare ?? null;
}

async function groupPageReader(spare: SpareCopiesService): Promise<number | null> {
  const link = { id: 1, intent: 'missing', showsContact: true } as ShareLinkEntity & { intent: TDeckShareIntent };
  const deck = { id: 11, name: 'Deck', hero: 'Hero', heroIdentifier: null, format: 'Classic Constructed', updatedAt: new Date('2026-10-01T00:00:00Z') } as TrackedDeckEntity;
  const lookup = createMock<SharedDeckLookup>();
  lookup.findLive.mockResolvedValue({ link, deck, owner: OWNER });
  const collection = createMock<CollectionReadService>();
  collection.loadOwned.mockResolvedValue(new Map([[PACK_HUNT, 6]]));
  const deckCards = createMock<Repository<DeckCardEntity>>();
  deckCards.find.mockResolvedValue([]);
  const groupAsk = createMock<SharedGroupAskService>();
  groupAsk.cardsFor.mockResolvedValue({
    cards: [
      {
        cardIdentifier: PACK_HUNT, name: 'Pack Hunt', pitch: 3, type: '', slot: 'mainboard', quantity: 2, inventoryQuantity: 0, imageUrl: null, state: 'not_on_site',
        unitPriceCents: null, lineCents: null, availableCopies: null, foilOnly: false, promoOnly: false, productUrl: null, owned: null, spare: null,
      },
    ],
    storeSummary: { copies: 0, cents: 0 },
  });
  const service = new SharedDeckViewService(lookup, createMock<ShareEventsService>(), createMock<SharedDeckMissingService>(), collection, config(), deckCards, groupAsk, spare, createMock<SharedDeckReplacements>());
  const page = await service.view('live', visitor(DUDA));
  return page.missing[0]?.spare ?? null;
}

async function tutorReader(spare: SpareCopiesService): Promise<number | null> {
  const dataSource = createMock<DataSource>();
  // What each deck already uses is the Tutor's own list; the spare count must not come from it.
  dataSource.query.mockResolvedValue([
    { cardIdentifier: PACK_HUNT, deckId: 1, quantity: 3 },
    { cardIdentifier: PACK_HUNT, deckId: 2, quantity: 2 },
    { cardIdentifier: PACK_HUNT, deckId: 3, quantity: 2 },
  ]);
  const collection = createMock<CollectionReadService>();
  collection.loadOwned.mockResolvedValue(new Map([[PACK_HUNT, 6]]));
  const tools = new ChatToolsService(
    dataSource,
    collection,
    createMock<RecommendationsService>(),
    createMock<RulesImportService>(),
    createMock<CommunityDecksService>(),
    createMock<ChatPricesService>(),
    spare,
  );
  const result = (await tools.forTurn({ userId: DUDA, locale: 'pt-BR' }).toolbox['get_collection']!({})) as { cards: Array<{ cardIdentifier: string; spare: number }> };
  return result.cards.find((card) => card.cardIdentifier === PACK_HUNT)?.spare ?? null;
}

describe('every spare reader', () => {
  it('returns the same count from the one function', async () => {
    const spare = spareService();

    const counts = {
      sobrando: await sobrandoReader(spare),
      wantList: await wantListReader(spare),
      groupPage: await groupPageReader(spare),
      tutor: await tutorReader(spare),
    };

    expect(counts).toEqual({ sobrando: 1, wantList: 1, groupPage: 1, tutor: 1 });
  });
});
