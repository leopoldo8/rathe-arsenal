import { createMock } from '@golevelup/ts-jest';
import { IsNull, Not, Repository, In } from 'typeorm';
import { catalog, ICatalogCard } from '@rathe-arsenal/engine';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { VisitorDecksMissingService } from '../visitor-decks-missing.service';

const [CARD_A, CARD_B] = catalog.cards
  .filter((card) => card.pitch === 1 && card.types[0] !== 'Hero')
  .slice(0, 2) as [ICatalogCard, ICatalogCard];

const row = (trackedDeckId: number, card: ICatalogCard, quantity: number, slot = 'mainboard'): DeckCardEntity =>
  ({ trackedDeckId, cardIdentifier: card.cardIdentifier, quantity, slot }) as DeckCardEntity;

function build(decks: number[], rows: DeckCardEntity[], names: Readonly<Record<number, string>> = {}) {
  const deckRepo = createMock<Repository<TrackedDeckEntity>>();
  deckRepo.find.mockResolvedValue(decks.map((id) => ({ id, name: names[id] ?? `Deck ${id}` }) as TrackedDeckEntity));
  const cardRepo = createMock<Repository<DeckCardEntity>>();
  cardRepo.find.mockResolvedValue(rows);
  return { service: new VisitorDecksMissingService(deckRepo, cardRepo), deckRepo, cardRepo };
}

describe('VisitorDecksMissingService.missingByCard', () => {
  it('reads only the visitor non-retired decks', async () => {
    const { service, deckRepo, cardRepo } = build([1, 2], []);

    await service.missingByCard('visitor-1', new Set([CARD_A.cardIdentifier]), new Map());

    expect(deckRepo.find).toHaveBeenCalledWith({ where: { userId: 'visitor-1', status: Not('retired'), deletedAt: IsNull() }, select: { id: true, name: true } });
    expect(cardRepo.find).toHaveBeenCalledWith({ where: { trackedDeckId: In([1, 2]) } });
  });

  it('sums each deck own gap, across decks and slots', async () => {
    const { service } = build(
      [1, 2],
      [row(1, CARD_A, 3), row(1, CARD_A, 1, 'sideboard'), row(2, CARD_A, 2), row(2, CARD_B, 1)],
    );

    const missing = await service.missingByCard(
      'visitor-1',
      new Set([CARD_A.cardIdentifier, CARD_B.cardIdentifier]),
      new Map([[CARD_A.cardIdentifier, 1]]),
    );

    // Deck 1 needs 4 of A and owns 1 (3 missing); deck 2 needs 2 and owns 1 (1 missing).
    expect(missing.get(CARD_A.cardIdentifier)).toBe(4);
    expect(missing.get(CARD_B.cardIdentifier)).toBe(1);
  });

  it('counts only the cards asked about', async () => {
    const { service } = build([1], [row(1, CARD_A, 3), row(1, CARD_B, 1)]);

    const missing = await service.missingByCard('visitor-1', new Set([CARD_B.cardIdentifier]), new Map());

    expect([...missing.keys()]).toEqual([CARD_B.cardIdentifier]);
  });

  it('answers empty without touching the database when nothing is asked', async () => {
    const { service, deckRepo } = build([1], []);

    expect((await service.missingByCard('visitor-1', new Set(), new Map())).size).toBe(0);
    expect(deckRepo.find).not.toHaveBeenCalled();
  });

  it('answers empty when the visitor has no active deck', async () => {
    const { service, cardRepo } = build([], []);

    expect((await service.missingByCard('visitor-1', new Set([CARD_A.cardIdentifier]), new Map())).size).toBe(0);
    expect(cardRepo.find).not.toHaveBeenCalled();
  });
});

describe('VisitorDecksMissingService.missingPerDeck', () => {
  it('missing copies per deck, not summed', async () => {
    const { service } = build(
      [1, 2],
      [row(1, CARD_A, 3), row(2, CARD_A, 2), row(2, CARD_B, 1)],
      { 1: 'Kayo CC', 2: 'Rhinar CC' },
    );

    const perDeck = await service.missingPerDeck(
      'visitor-1',
      new Set([CARD_A.cardIdentifier, CARD_B.cardIdentifier]),
      new Map([[CARD_A.cardIdentifier, 1]]),
    );

    // Each deck is judged against the whole collection: Kayo CC needs 3 and owns 1 (2 missing), Rhinar CC needs 2 (1 missing).
    expect(perDeck.get(CARD_A.cardIdentifier)).toEqual([
      { deckId: 1, deckName: 'Kayo CC', missing: 2 },
      { deckId: 2, deckName: 'Rhinar CC', missing: 1 },
    ]);
    expect(perDeck.get(CARD_B.cardIdentifier)).toEqual([{ deckId: 2, deckName: 'Rhinar CC', missing: 1 }]);
  });

  it('leaves out a deck that misses nothing of the card', async () => {
    const { service } = build([1, 2], [row(1, CARD_A, 1), row(2, CARD_A, 3)], { 1: 'Kayo CC', 2: 'Rhinar CC' });

    const perDeck = await service.missingPerDeck('visitor-1', new Set([CARD_A.cardIdentifier]), new Map([[CARD_A.cardIdentifier, 1]]));

    expect(perDeck.get(CARD_A.cardIdentifier)).toEqual([{ deckId: 2, deckName: 'Rhinar CC', missing: 2 }]);
  });
});
