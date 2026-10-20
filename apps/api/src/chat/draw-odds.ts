import { ICatalogCard } from '@rathe-arsenal/engine';
import { IDeckRow, mainboardCards } from './deck-rows';

export interface IDrawFilter {
  readonly cardIdentifiers?: readonly string[] | undefined;
  readonly pitch?: number | undefined;
  readonly cardType?: string | undefined;
}

export interface IDrawOdds {
  readonly heroIntellect: number;
  readonly deckSize: number;
  readonly matchingCopies: number;
  readonly cardsSeen: number;
  readonly atLeast: number;
  readonly chance: number;
  readonly filters: IDrawFilter;
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let index = 1; index <= k; index += 1) result = (result * (n - k + index)) / index;
  return result;
}

export function chanceOfAtLeast(input: { readonly deckSize: number; readonly matching: number; readonly drawn: number; readonly atLeast: number }): number {
  const { deckSize, matching, atLeast } = input;
  const drawn = Math.min(input.drawn, deckSize);
  if (atLeast <= 0) return 1;
  let chance = 0;
  for (let hits = atLeast; hits <= Math.min(matching, drawn); hits += 1) {
    chance += (choose(matching, hits) * choose(deckSize - matching, drawn - hits)) / choose(deckSize, drawn);
  }
  return chance;
}

function matches(card: ICatalogCard, filter: IDrawFilter): boolean {
  const kind = filter.cardType?.toLowerCase();
  return (
    (filter.cardIdentifiers === undefined || filter.cardIdentifiers.includes(card.cardIdentifier)) &&
    (filter.pitch === undefined || card.pitch === filter.pitch) &&
    (kind === undefined || [...card.types, ...card.subtypes].some((value) => String(value).toLowerCase() === kind))
  );
}

export function drawOdds(input: {
  readonly hero: ICatalogCard;
  readonly rows: readonly IDeckRow[];
  readonly filter: IDrawFilter;
  readonly atLeast: number;
  readonly extraDraws: number;
}): IDrawOdds {
  const mainboard = mainboardCards(input.rows);
  const deckSize = mainboard.reduce((sum, { quantity }) => sum + quantity, 0);
  const matchingCopies = mainboard.filter(({ card }) => matches(card, input.filter)).reduce((sum, { quantity }) => sum + quantity, 0);
  const heroIntellect = input.hero.intellect ?? 0;
  const cardsSeen = heroIntellect + input.extraDraws;
  const chance = chanceOfAtLeast({ deckSize, matching: matchingCopies, drawn: cardsSeen, atLeast: input.atLeast });
  const filters = Object.fromEntries(Object.entries(input.filter).filter(([, value]) => value !== undefined)) as IDrawFilter;
  return { heroIntellect, deckSize, matchingCopies, cardsSeen, atLeast: input.atLeast, chance: Math.round(chance * 1000) / 1000, filters };
}
