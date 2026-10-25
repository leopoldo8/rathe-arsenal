import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { SpareCopiesService } from '../../collection/spare/spare-copies.service';
import { CollectionReadService } from '../../collection/collection-read.service';
import { CardListLineEntity } from '../../database/entities/card-list-line.entity';
import { CardListEntity } from '../../database/entities/card-list.entity';
import { ShareLinkEntity } from '../../database/entities/share-link.entity';
import { EUserRole, UserEntity } from '../../database/entities/user.entity';
import { ShareEventsService } from '../share-events.service';
import { SharedListLookup } from '../shared-list-lookup';
import { SharedListViewService } from '../shared-list-view.service';
import { VisitorDecksMissingService } from '../visitor-decks-missing.service';

const [CARD_A, CARD_B] = catalog.cards
  .filter((card) => card.pitch === 1 && card.types[0] !== 'Hero')
  .slice(0, 2) as [ICatalogCard, ICatalogCard];

const OWNER = { id: 'owner-1', displayName: 'Rodrigo', whatsappNumber: '5551999990000' } as UserEntity;

const visitor = (userId: string): ICurrentUser => ({
  userId,
  email: 'v@example.com',
  role: EUserRole.User,
  chatAccess: false,
});

const line = (id: number, cardIdentifier: string, extra: Partial<CardListLineEntity> = {}): CardListLineEntity =>
  ({
    id,
    cardIdentifier,
    quantity: 2,
    printing: null,
    condition: null,
    priceCents: null,
    soldAt: null,
    ...extra,
  }) as CardListLineEntity;

function build(options: { kind?: 'want' | 'sell'; showsContact?: boolean; lines?: CardListLineEntity[] } = {}) {
  const kind = options.kind ?? 'sell';
  const link = { id: 1, intent: kind, showsContact: options.showsContact ?? true } as ShareLinkEntity & {
    intent: 'want' | 'sell';
  };
  const list = {
    id: 21,
    kind,
    name: 'Sobras',
    notes: 'Retiro em Porto Alegre',
    totalPriceCents: 42000,
    updatedAt: new Date('2026-10-01T00:00:00Z'),
  } as CardListEntity;
  const lookup = createMock<SharedListLookup>();
  lookup.findLive.mockImplementation(async (token) => (token === 'live' ? { link, list, owner: OWNER } : null));
  const events = createMock<ShareEventsService>();
  const collection = createMock<CollectionReadService>();
  collection.loadOwned.mockImplementation(async (userId) =>
    userId === 'visitor-1' ? new Map([[CARD_A.cardIdentifier, 1]]) : new Map(),
  );
  const visitorDecks = createMock<VisitorDecksMissingService>();
  visitorDecks.missingByCard.mockResolvedValue(new Map([[CARD_A.cardIdentifier, 3]]));
  const lines = createMock<Repository<CardListLineEntity>>();
  lines.find.mockResolvedValue(options.lines ?? [line(1, CARD_A.cardIdentifier), line(2, CARD_B.cardIdentifier, { soldAt: new Date() })]);
  const config = createMock<ConfigService>();
  config.get.mockReturnValue('https://app.example');
  const spareCopies = createMock<SpareCopiesService>();
  spareCopies.spareByCard.mockResolvedValue({ needsRule: false, spare: new Map() });
  return {
    service: new SharedListViewService(lookup, events, collection, visitorDecks, config, spareCopies, lines),
    events,
    visitorDecks,
  };
}

describe('SharedListViewService.view', () => {
  it('rejects a dead token with 404 and records nothing', async () => {
    const { service, events } = build();

    await expect(service.view('dead', null)).rejects.toMatchObject({ status: 404 });
    expect(events.record).not.toHaveBeenCalled();
  });

  it('records an anonymous open with the link intent', async () => {
    const { service, events } = build();

    await service.view('live', null);

    expect(events.record).toHaveBeenCalledWith({
      kind: 'opened',
      targetKind: 'list',
      targetId: 21,
      intent: 'sell',
      ownerUserId: 'owner-1',
      actorUserId: null,
    });
  });

  it('records a signed-in visitor but never the owner', async () => {
    const { service, events } = build();

    await service.view('live', visitor('visitor-1'));
    await service.view('live', visitor('owner-1'));

    expect(events.record).toHaveBeenCalledTimes(1);
    expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 'visitor-1' }));
  });

  it('shows every line, sold included, and only gives the owner the list id', async () => {
    const { service } = build();

    const asVisitor = await service.view('live', null);
    const asOwner = await service.view('live', visitor('owner-1'));

    expect(asVisitor.lines.map((entry) => [entry.id, entry.sold])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(asVisitor.listId).toBeNull();
    expect(asOwner.listId).toBe(21);
    expect(asOwner.isOwner).toBe(true);
    expect(asVisitor.url).toBe(`https://app.example/l/live`);
  });

  it('hides the contact number when the link switch is off', async () => {
    const on = await build().service.view('live', null);
    const off = await build({ showsContact: false }).service.view('live', null);

    expect(on.contactWhatsapp).toBe('5551999990000');
    expect(off.contactWhatsapp).toBeNull();
  });

  it('carries the total only on sell lists and strips sell-only fields from a want list', async () => {
    const sell = await build().service.view('live', null);
    const want = await build({
      kind: 'want',
      lines: [line(1, CARD_A.cardIdentifier, { condition: 'NM', priceCents: 100, soldAt: new Date() })],
    }).service.view('live', null);

    expect(sell.totalPriceCents).toBe(42000);
    expect(want.totalPriceCents).toBeNull();
    expect(want.lines[0]).toMatchObject({ condition: null, priceCents: null, sold: false, printingLabel: null });
  });
});

describe('SharedListViewService.matches', () => {
  it('rejects a dead token with 404', async () => {
    await expect(build().service.matches('dead', 'visitor-1')).rejects.toMatchObject({ status: 404 });
  });

  it('gives the owner no lines and computes nothing', async () => {
    const { service, visitorDecks } = build();

    expect(await service.matches('live', 'owner-1')).toEqual({ lines: [] });
    expect(visitorDecks.missingByCard).not.toHaveBeenCalled();
  });

  it('on a sell list asks the deck gap only for lines still for sale', async () => {
    const { service, visitorDecks } = build();

    const result = await service.matches('live', 'visitor-1');

    expect(visitorDecks.missingByCard).toHaveBeenCalledWith(
      'visitor-1',
      new Set([CARD_A.cardIdentifier]),
      expect.any(Map),
    );
    expect(result.lines).toEqual([
      { lineId: 1, owned: 1, missingInDecks: 3 },
      { lineId: 2, owned: 0, missingInDecks: 0 },
    ]);
  });

  it('on a want list reads only the collection', async () => {
    const { service, visitorDecks } = build({ kind: 'want' });

    const result = await service.matches('live', 'visitor-1');

    expect(visitorDecks.missingByCard).not.toHaveBeenCalled();
    expect(result.lines[0]).toEqual({ lineId: 1, owned: 1, missingInDecks: 0 });
  });
});
