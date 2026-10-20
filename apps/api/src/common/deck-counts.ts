import { ICatalogCard } from '@rathe-arsenal/engine';

export interface ICountedCard {
  readonly card: ICatalogCard;
  readonly quantity: number;
}

export interface IRange {
  readonly average: number;
  readonly min: number;
  readonly max: number;
}

const PITCH_NAMES: Readonly<Record<number, 'red' | 'yellow' | 'blue'>> = { 1: 'red', 2: 'yellow', 3: 'blue' };

export function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function tally(cards: readonly ICountedCard[], keyOf: (card: ICatalogCard) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { card, quantity } of cards) counts.set(keyOf(card), (counts.get(keyOf(card)) ?? 0) + quantity);
  return counts;
}

export function countByPitch(cards: readonly ICountedCard[]): Record<string, number> {
  const counts = tally(cards, (card) => (card.pitch === null ? 'noPitch' : (PITCH_NAMES[card.pitch] ?? 'noPitch')));
  return { red: counts.get('red') ?? 0, yellow: counts.get('yellow') ?? 0, blue: counts.get('blue') ?? 0, noPitch: counts.get('noPitch') ?? 0 };
}

export function countByCost(cards: readonly ICountedCard[]): Record<string, number> {
  const counts = tally(cards, (card) => (card.cost === null ? 'noCost' : String(card.cost)));
  const order = (key: string): number => (key === 'noCost' ? Number.POSITIVE_INFINITY : Number(key));
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => order(a) - order(b)));
}

export function countByType(cards: readonly ICountedCard[]): Record<string, number> {
  const counts = tally(cards, (card) => [...card.types, ...card.subtypes].join(' '));
  return Object.fromEntries([...counts.entries()].sort(([, a], [, b]) => b - a));
}

export function countByDefense(cards: readonly ICountedCard[]): Record<string, number> {
  const counts = tally(cards, (card) => (card.defense === null ? 'noDefense' : String(card.defense)));
  const order = (key: string): number => (key === 'noDefense' ? Number.POSITIVE_INFINITY : Number(key));
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => order(a) - order(b)));
}

/** Average, lowest and highest of each key across decks; a deck without the key counts as 0. */
export function rangeAcross(perDeck: readonly Record<string, number>[]): Record<string, IRange> {
  const keys = [...new Set(perDeck.flatMap((counts) => Object.keys(counts)))];
  const ranges = keys.map((key): [string, IRange] => {
    const values = perDeck.map((counts) => counts[key] ?? 0);
    return [key, { average: roundTenth(values.reduce((sum, value) => sum + value, 0) / values.length), min: Math.min(...values), max: Math.max(...values) }];
  });
  return Object.fromEntries(ranges);
}
