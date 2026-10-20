import { ICommunityDecks } from '../reference/community-decks';
import { findCard } from './deck-rows';

interface IDeckCardRow {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly quantity: number;
}

export interface ICommunityComparison {
  readonly yourCards: readonly { readonly cardIdentifier: string; readonly name: string; readonly inYourDeck: number; readonly referenceDecks: number }[];
  readonly commonCardsYouLack: readonly { readonly cardIdentifier: string; readonly name: string; readonly decks: number; readonly averageCopies: number }[];
}

const nameOf = (cardIdentifier: string): string => findCard(cardIdentifier)?.name ?? cardIdentifier;

export function compareWithCommunity(found: ICommunityDecks, deckCards: readonly IDeckCardRow[]): ICommunityComparison {
  const yours = new Map<string, number>();
  for (const row of deckCards) if (row.slot !== 'hero') yours.set(row.cardIdentifier, (yours.get(row.cardIdentifier) ?? 0) + row.quantity);
  const yourCards = [...yours.entries()]
    .map(([cardIdentifier, inYourDeck]) => ({ cardIdentifier, name: nameOf(cardIdentifier), inYourDeck, referenceDecks: found.deckCount[cardIdentifier] ?? 0 }))
    .sort((a, b) => a.referenceDecks - b.referenceDecks || a.name.localeCompare(b.name));
  const commonCardsYouLack = found.cards
    .filter((card) => card.decks * 2 >= found.decks.length && !yours.has(card.cardIdentifier))
    .map((card) => ({ cardIdentifier: card.cardIdentifier, name: nameOf(card.cardIdentifier), decks: card.decks, averageCopies: card.averageCopies }));
  return { yourCards, commonCardsYouLack };
}
