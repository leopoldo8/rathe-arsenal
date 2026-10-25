import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { SpareCopiesService } from '../../collection/spare/spare-copies.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { ShareLinkEntity, TDeckShareIntent } from '../../database/entities/share-link.entity';
import { EUserRole, UserEntity } from '../../database/entities/user.entity';
import { ShareEventsService } from '../share-events.service';
import { SharedDeckLookup } from '../shared-deck-lookup';
import { SharedDeckMissingService } from '../shared-deck-missing.service';
import { SharedDeckViewService } from '../shared-deck-view.service';
import { SharedGroupAskService } from '../shared-group-ask.service';

const [CARD_A, CARD_B] = catalog.cards
  .filter((card) => card.pitch === 1 && card.types[0] !== 'Hero')
  .slice(0, 2) as [ICatalogCard, ICatalogCard];

const OWNER = { id: 'owner-1', displayName: 'Rodrigo', whatsappNumber: '5551999990000' } as UserEntity;
const DECK = {
  id: 11,
  name: 'My deck',
  hero: 'Some Hero',
  heroIdentifier: 'some-hero',
  format: 'cc',
  updatedAt: new Date('2026-10-01T00:00:00Z'),
} as TrackedDeckEntity;

const ROWS = [
  { cardIdentifier: CARD_A.cardIdentifier, quantity: 3, inventoryQuantity: 0, slot: 'mainboard' },
  { cardIdentifier: CARD_B.cardIdentifier, quantity: 1, inventoryQuantity: 0, slot: 'mainboard' },
] as DeckCardEntity[];

const visitor = (userId: string): ICurrentUser => ({
  userId,
  email: 'v@example.com',
  role: EUserRole.User,
  chatAccess: false,
});

function build(
  inventories: Record<string, Map<string, number>> = {},
  options: { intent?: TDeckShareIntent; showsContact?: boolean; deck?: TrackedDeckEntity; rows?: DeckCardEntity[] } = {},
) {
  const link = {
    id: 1,
    intent: options.intent ?? 'missing',
    showsContact: options.showsContact ?? true,
  } as ShareLinkEntity & { intent: TDeckShareIntent };
  const lookup = createMock<SharedDeckLookup>();
  lookup.findLive.mockImplementation(async (token, intent) =>
    token === 'live' && (!intent || intent === link.intent) ? { link, deck: options.deck ?? DECK, owner: OWNER } : null,
  );
  const events = createMock<ShareEventsService>();
  const collection = createMock<CollectionReadService>();
  collection.loadOwned.mockImplementation(async (userId, identifiers) => {
    const inventory = inventories[userId] ?? new Map<string, number>();
    return identifiers ? new Map([...inventory].filter(([id]) => identifiers.includes(id))) : inventory;
  });
  const config = createMock<ConfigService>();
  config.get.mockReturnValue('https://app.example');
  const deckCards = createMock<Repository<DeckCardEntity>>();
  deckCards.find.mockResolvedValue(options.rows ?? ROWS);
  const missingCards = new SharedDeckMissingService(collection);
  // The group ask reads store answers, which this spec does not cover: it gets the plain missing cards with no store answer.
  const groupAsk = createMock<SharedGroupAskService>();
  groupAsk.cardsFor.mockImplementation(async (ownerId) => ({
    cards: (await missingCards.missingFor(ownerId, options.rows ?? ROWS)).map((card) => ({
      ...card,
      state: 'not_on_site' as const,
      unitPriceCents: null,
      lineCents: null,
      availableCopies: null,
      foilOnly: false,
      promoOnly: false,
      productUrl: null,
      owned: null,
      spare: null,
    })),
    storeSummary: { copies: 0, cents: 0 },
  }));
  const spareCopies = createMock<SpareCopiesService>();
  spareCopies.spareByCard.mockResolvedValue({ needsRule: false, spare: new Map() });
  const service = new SharedDeckViewService(lookup, events, missingCards, collection, config, deckCards, groupAsk, spareCopies);
  return { service, events };
}

describe('SharedDeckViewService.view legality', () => {
  const rhinar = catalog.cards.find((card) => card.cardIdentifier === 'rhinar');
  const blitzCards = catalog.cards
    .filter((card) => card.legalFormats.includes('Blitz' as never) && card.legalHeroes.includes('Rhinar' as never))
    .slice(0, 30);
  const blitzDeck = { ...DECK, hero: 'Rhinar', heroIdentifier: 'rhinar', format: 'Blitz' } as TrackedDeckEntity;
  const blitzRows = [
    { cardIdentifier: blitzCards[0]!.cardIdentifier, quantity: 2, inventoryQuantity: 0, slot: 'mainboard' },
    ...blitzCards.slice(1).map((card) => ({ cardIdentifier: card.cardIdentifier, quantity: 1, inventoryQuantity: 0, slot: 'mainboard' })),
  ] as DeckCardEntity[];

  it('returns the deck verdict in its own format and in each other format', async () => {
    const { service } = build({}, { intent: 'deck', deck: blitzDeck, rows: blitzRows });

    const result = await service.view('live', null);

    expect(rhinar?.young).toBe(true);
    expect(result.legality?.category).toBe('illegal');
    expect(result.legality?.heroYoung).toBe(true);
    expect(result.legality?.details.map((detail) => detail.code)).toEqual(
      expect.arrayContaining(['too_many_copies', 'mainboard_not_exact']),
    );
    expect(result.legality?.otherFormats.map((other) => other.format)).toEqual([
      'Classic Constructed',
      'Living Legend',
      'Silver Age',
    ]);
    const livingLegend = result.legality?.otherFormats.find((other) => other.format === 'Living Legend');
    expect(livingLegend?.details.map((detail) => detail.code)).toContain('hero_not_legal');
  });

  it('answers no verdict for the missing intent', async () => {
    const { service } = build({}, { intent: 'missing', deck: blitzDeck, rows: blitzRows });

    const result = await service.view('live', null);

    expect(result.legality).toBeNull();
  });

  it('calls a format outside the four unchecked', async () => {
    const { service } = build({}, { intent: 'deck' });

    const result = await service.view('live', null);

    expect(result.legality?.category).toBe('unchecked');
    expect(result.legality?.otherFormats).toHaveLength(4);
  });
});

describe('SharedDeckViewService.view', () => {
  it('groups what the owner is missing and counts it for the missing intent', async () => {
    const { service } = build({ 'owner-1': new Map([[CARD_A.cardIdentifier, 1]]) });

    const result = await service.view('live', visitor('visitor-1'));

    expect(result.intent).toBe('missing');
    expect(result.cards).toEqual([]);
    expect(result.totalCards).toBe(4);
    expect(result.missing.map((card) => [card.cardIdentifier, card.quantity])).toEqual(
      expect.arrayContaining([
        [CARD_A.cardIdentifier, 2],
        [CARD_B.cardIdentifier, 1],
      ]),
    );
    expect(result.missingCount).toBe(3);
    expect(result.url).toBe('https://app.example/d/live');
    expect(result.sharerName).toBe('Rodrigo');
  });

  it('lists every card and no missing card for the deck intent', async () => {
    const { service } = build({}, { intent: 'deck' });

    const result = await service.view('live', null);

    expect(result.intent).toBe('deck');
    expect(result.cards.map((card) => card.cardIdentifier)).toEqual([CARD_A.cardIdentifier, CARD_B.cardIdentifier]);
    expect(result.missing).toEqual([]);
    expect(result.missingCount).toBe(0);
  });

  it('exposes the contact only while the link shows it', async () => {
    const shown = await build().service.view('live', null);
    const hidden = await build({}, { showsContact: false }).service.view('live', null);

    expect(shown.contactWhatsapp).toBe('5551999990000');
    expect(hidden.contactWhatsapp).toBeNull();
  });

  it('records opened for a visitor and for an anonymous request', async () => {
    const { service, events } = build();

    await service.view('live', visitor('visitor-1'));
    await service.view('live', null);

    expect(events.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'opened', intent: 'missing', actorUserId: 'visitor-1' }));
    expect(events.record).toHaveBeenNthCalledWith(2, expect.objectContaining({ kind: 'opened', actorUserId: null }));
  });

  it('does not record the owner opening their own link and returns the deck id only to them', async () => {
    const { service, events } = build();

    const asOwner = await service.view('live', visitor('owner-1'));
    const asVisitor = await build().service.view('live', visitor('visitor-1'));

    expect(events.record).not.toHaveBeenCalled();
    expect(asOwner).toMatchObject({ isOwner: true, deckId: 11 });
    expect(asVisitor).toMatchObject({ isOwner: false, deckId: null });
  });

  it('answers 404 SHARE_LINK_UNAVAILABLE for a dead token without recording', async () => {
    const { service, events } = build();

    await expect(service.view('dead', null)).rejects.toMatchObject({ status: 404 });
    expect(events.record).not.toHaveBeenCalled();
  });
});

describe('SharedDeckViewService.coverage', () => {
  it('counts only exact copies from the visitor collection', async () => {
    const { service } = build({ 'visitor-1': new Map([[CARD_A.cardIdentifier, 2]]) }, { intent: 'deck' });

    expect(await service.coverage('live', 'visitor-1')).toEqual({
      ownedCopies: 2,
      totalCopies: 4,
      percent: 50,
      collectionEmpty: false,
    });
  });

  it('caps owned copies at the deck quantity', async () => {
    const { service } = build({
      'visitor-1': new Map([
        [CARD_A.cardIdentifier, 9],
        [CARD_B.cardIdentifier, 9],
      ]),
    }, { intent: 'deck' });

    expect(await service.coverage('live', 'visitor-1')).toMatchObject({ ownedCopies: 4, percent: 100 });
  });

  it('is zero for an empty collection', async () => {
    expect(await build({}, { intent: 'deck' }).service.coverage('live', 'visitor-1')).toMatchObject({ ownedCopies: 0, percent: 0, collectionEmpty: true });
  });

  it('answers 404 for a dead token', async () => {
    await expect(build({}, { intent: 'deck' }).service.coverage('dead', 'visitor-1')).rejects.toMatchObject({ status: 404 });
  });

  it('answers 404 for a missing-intent link', async () => {
    await expect(build().service.coverage('live', 'visitor-1')).rejects.toMatchObject({ status: 404 });
  });
});

describe('SharedDeckViewService.matches', () => {
  it('reports what the visitor owns of each missing card, zero included', async () => {
    const { service } = build({ 'visitor-1': new Map([[CARD_B.cardIdentifier, 2]]) });

    const result = await service.matches('live', 'visitor-1');

    expect(result.cards).toEqual(
      expect.arrayContaining([
        { cardIdentifier: CARD_A.cardIdentifier, owned: 0 },
        { cardIdentifier: CARD_B.cardIdentifier, owned: 2 },
      ]),
    );
    expect(result.cards).toHaveLength(2);
  });

  it('answers 404 for a deck-intent link', async () => {
    await expect(build({}, { intent: 'deck' }).service.matches('live', 'visitor-1')).rejects.toMatchObject({ status: 404 });
  });
});
