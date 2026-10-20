import { ICommunityDecks } from '../../reference/community-decks';
import { compareWithCommunity } from '../community-comparison';

const summary = { name: 'x', updatedAt: '2026-10-01', hasResults: false, matchupPlans: 0, inventoryCards: 0, url: 'u', mainboardByType: {}, mainboardByPitch: {}, mainboardByCost: {} };
const row = (cardIdentifier: string, decks: number, averageCopies: number) => ({ cardIdentifier, name: cardIdentifier, pitch: 1, type: null, slot: 'mainboard', decks, averageCopies });

const FOUND: ICommunityDecks = {
  inspected: 5,
  decks: [summary, summary, summary, summary],
  mainboardRange: { byType: {}, byPitch: {}, byCost: {} },
  cards: [row('boltn-shot-red', 4, 2), row('widowmaker-yellow', 2, 1.5), row('toxicity-red', 1, 2), row('drill-shot-red', 1, 1)],
  deckCount: { 'boltn-shot-red': 4, 'widowmaker-yellow': 2, 'toxicity-red': 1, 'drill-shot-red': 1 },
};

describe('compareWithCommunity', () => {
  const comparison = compareWithCommunity(FOUND, [
    { cardIdentifier: 'azalea', slot: 'hero', quantity: 1 },
    { cardIdentifier: 'boltn-shot-red', slot: 'mainboard', quantity: 2 },
    { cardIdentifier: 'toxicity-red', slot: 'mainboard', quantity: 1 },
    { cardIdentifier: 'fire-in-the-hole-red', slot: 'mainboard', quantity: 2 },
  ]);

  it("says, for each of the user's cards, in how many reference decks it appears, the rarest first and the hero left out", () => {
    expect(comparison.yourCards).toEqual([
      { cardIdentifier: 'fire-in-the-hole-red', name: 'Fire in the Hole', inYourDeck: 2, referenceDecks: 0 },
      { cardIdentifier: 'toxicity-red', name: 'Toxicity', inYourDeck: 1, referenceDecks: 1 },
      { cardIdentifier: 'boltn-shot-red', name: "Bolt'n' Shot", inYourDeck: 2, referenceDecks: 4 },
    ]);
  });

  it('lists the cards at least half of the reference decks play that the user lacks', () => {
    expect(comparison.commonCardsYouLack).toEqual([{ cardIdentifier: 'widowmaker-yellow', name: 'Widowmaker', decks: 2, averageCopies: 1.5 }]);
  });
});
