import type { ICatalogCard } from '@rathe-arsenal/engine';

function typeLineOf(card: ICatalogCard): string {
  return [...card.classes, ...card.talents, ...card.types, ...card.subtypes].join(' ').toLowerCase();
}

function wordsOf(query: string): string[] {
  return query.split(/\s+/).filter((word) => word !== '');
}

/**
 * Cards for a search, best first: the name holds the query, then the type line (class, talent, type and subtype) holds every
 * word of it, then the rules text holds it. "Brute weapon" finds Romping Club by its class and type, not its name.
 */
export function findCardsMatching(cards: readonly ICatalogCard[], text: string): ICatalogCard[] {
  const query = text.trim().toLowerCase();
  if (query === '') return [];
  const words = wordsOf(query);
  const byName: ICatalogCard[] = [];
  const byTypeLine: ICatalogCard[] = [];
  const byText: ICatalogCard[] = [];
  for (const card of cards) {
    if (card.name.toLowerCase().includes(query)) byName.push(card);
    else if (words.every((word) => `${card.name.toLowerCase()} ${typeLineOf(card)}`.includes(word))) byTypeLine.push(card);
    else if ((card.functionalText ?? '').toLowerCase().includes(query)) byText.push(card);
  }
  return [...byName, ...byTypeLine, ...byText];
}
