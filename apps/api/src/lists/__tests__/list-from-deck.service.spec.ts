import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { DeckCardEntity } from '../../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../../database/entities/tracked-deck.entity';
import { SharedDeckMissingService } from '../../sharing/shared-deck-missing.service';
import { ListFromDeckService } from '../list-from-deck.service';

describe('ListFromDeckService', () => {
  const decks = createMock<Repository<TrackedDeckEntity>>();
  const deckCards = createMock<Repository<DeckCardEntity>>();
  const missing = createMock<SharedDeckMissingService>();
  const service = new ListFromDeckService(decks, deckCards, missing);

  const rows = [
    { cardIdentifier: 'a', quantity: 2, slot: 'mainboard' },
    { cardIdentifier: 'a', quantity: 1, slot: 'sideboard' },
    { cardIdentifier: 'b', quantity: 19, slot: 'mainboard' },
    { cardIdentifier: 'b', quantity: 5, slot: 'sideboard' },
  ] as DeckCardEntity[];

  beforeEach(() => {
    jest.resetAllMocks();
    decks.findOne.mockResolvedValue({ id: 7 } as TrackedDeckEntity);
    deckCards.find.mockResolvedValue(rows);
  });

  it('takes every card of the deck for a sell list, summed per card and capped at 20', async () => {
    // Act
    const lines = await service.linesFor('user-1', 'sell', 7);

    // Assert
    expect(lines).toEqual([
      { cardIdentifier: 'a', quantity: 3 },
      { cardIdentifier: 'b', quantity: 20 },
    ]);
    expect(missing.missingFor).not.toHaveBeenCalled();
  });

  it('takes the missing cards for a want list, summed per card', async () => {
    // Arrange
    missing.missingFor.mockResolvedValue([
      { cardIdentifier: 'a', quantity: 1, slot: 'mainboard' },
      { cardIdentifier: 'a', quantity: 1, slot: 'sideboard' },
    ] as Awaited<ReturnType<SharedDeckMissingService['missingFor']>>);

    // Act
    const lines = await service.linesFor('user-1', 'want', 7);

    // Assert
    expect(lines).toEqual([{ cardIdentifier: 'a', quantity: 2 }]);
    expect(missing.missingFor).toHaveBeenCalledWith('user-1', rows);
  });

  it('answers DECK_NOT_FOUND for a deck that is not the user, or past the int range', async () => {
    decks.findOne.mockResolvedValue(null);
    await expect(service.linesFor('user-1', 'sell', 7)).rejects.toMatchObject({ response: { code: 'DECK_NOT_FOUND' } });
    await expect(service.linesFor('user-1', 'sell', 99_999_999_999)).rejects.toMatchObject({
      response: { code: 'DECK_NOT_FOUND' },
    });
  });
});
