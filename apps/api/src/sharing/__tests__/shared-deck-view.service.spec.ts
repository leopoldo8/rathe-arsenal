import { createMock } from '@golevelup/ts-jest';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { CollectionReadService } from '../../collection/collection-read.service';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { EUserRole, UserEntity } from '../../database/entities/user.entity';
import { ShareEventsService } from '../share-events.service';
import { SharedDeckLookup } from '../shared-deck-lookup';
import { SharedDeckViewService } from '../shared-deck-view.service';

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
  shareShowsContact: true,
  updatedAt: new Date('2026-10-01T00:00:00Z'),
} as TrackedDeckEntity;

const ROWS = [
  { cardIdentifier: CARD_A.cardIdentifier, quantity: 3, slot: 'mainboard' },
  { cardIdentifier: CARD_B.cardIdentifier, quantity: 1, slot: 'mainboard' },
] as DeckCardEntity[];

const visitor = (userId: string): ICurrentUser => ({
  userId,
  email: 'v@example.com',
  role: EUserRole.User,
  chatAccess: false,
});

function build(inventories: Record<string, Map<string, number>> = {}, deck: TrackedDeckEntity = DECK) {
  const lookup = createMock<SharedDeckLookup>();
  lookup.findLive.mockImplementation(async (token) =>
    token === 'live' ? { deck, owner: OWNER } : null,
  );
  const events = createMock<ShareEventsService>();
  const collection = createMock<CollectionReadService>();
  collection.loadOwned.mockImplementation(async (userId) => inventories[userId] ?? new Map());
  const config = createMock<ConfigService>();
  config.get.mockReturnValue('https://app.example');
  const deckCards = createMock<Repository<DeckCardEntity>>();
  deckCards.find.mockResolvedValue(ROWS);
  return { service: new SharedDeckViewService(lookup, events, collection, config, deckCards), events };
}

describe('SharedDeckViewService.view', () => {
  it('groups what the owner is missing and counts it', async () => {
    const { service } = build({ 'owner-1': new Map([[CARD_A.cardIdentifier, 1]]) });

    const result = await service.view('live', visitor('visitor-1'));

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

  it('exposes the contact only while the deck shows it', async () => {
    const shown = await build().service.view('live', null);
    const hidden = await build({}, { ...DECK, shareShowsContact: false } as TrackedDeckEntity).service.view('live', null);

    expect(shown.contactWhatsapp).toBe('5551999990000');
    expect(hidden.contactWhatsapp).toBeNull();
  });

  it('records opened for a visitor and for an anonymous request', async () => {
    const { service, events } = build();

    await service.view('live', visitor('visitor-1'));
    await service.view('live', null);

    expect(events.record).toHaveBeenNthCalledWith(1, expect.objectContaining({ kind: 'opened', actorUserId: 'visitor-1' }));
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
    const { service } = build({ 'visitor-1': new Map([[CARD_A.cardIdentifier, 2]]) });

    expect(await service.coverage('live', 'visitor-1')).toEqual({
      ownedCopies: 2,
      totalCopies: 4,
      percent: 50,
    });
  });

  it('caps owned copies at the deck quantity', async () => {
    const { service } = build({
      'visitor-1': new Map([
        [CARD_A.cardIdentifier, 9],
        [CARD_B.cardIdentifier, 9],
      ]),
    });

    expect(await service.coverage('live', 'visitor-1')).toMatchObject({ ownedCopies: 4, percent: 100 });
  });

  it('is zero for an empty collection', async () => {
    expect(await build().service.coverage('live', 'visitor-1')).toMatchObject({ ownedCopies: 0, percent: 0 });
  });

  it('answers 404 for a dead token', async () => {
    await expect(build().service.coverage('dead', 'visitor-1')).rejects.toMatchObject({ status: 404 });
  });
});
