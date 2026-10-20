import { TListKind } from '../database/entities/card-list.entity';
import { ISharedListLineMatch } from './dtos/shared-list.dto';

export interface IMatchLine {
  readonly id: number;
  readonly cardIdentifier: string;
  readonly sold: boolean;
}

/**
 * Want: what the visitor owns of each card. Sell: the same, plus the copies of that card the
 * visitor's decks still miss, only for lines that are still for sale (a sold line is no offer).
 */
export function buildListMatches(
  kind: TListKind,
  lines: readonly IMatchLine[],
  owned: ReadonlyMap<string, number>,
  missingInDecks: ReadonlyMap<string, number>,
): ISharedListLineMatch[] {
  return lines.map((line) => ({
    lineId: line.id,
    owned: owned.get(line.cardIdentifier) ?? 0,
    missingInDecks: kind === 'sell' && !line.sold ? (missingInDecks.get(line.cardIdentifier) ?? 0) : 0,
  }));
}
