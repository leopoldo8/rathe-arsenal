import type { ISharedListLine, ISharedListMatches } from '../../api/shared-lists';

export interface ILineMatch {
  readonly owned: number;
  readonly missingInDecks: number;
}

export type TMatchesByLine = ReadonlyMap<number, ILineMatch>;

export function matchesByLine(matches: ISharedListMatches | undefined): TMatchesByLine {
  return new Map((matches?.lines ?? []).map((line) => [line.lineId, line]));
}

export interface IVisitorSummary {
  /** Cards (lines) of the list the visitor has, or that are missing in their decks. */
  readonly count: number;
  readonly total: number;
}

/** How many cards of a want list the visitor already has. */
export function wantSummary(lines: readonly ISharedListLine[], matches: TMatchesByLine): IVisitorSummary {
  return { count: lines.filter((line) => (matches.get(line.id)?.owned ?? 0) > 0).length, total: lines.length };
}

/** How many cards of a sell list, still for sale, are missing in the visitor's decks. */
export function sellSummary(lines: readonly ISharedListLine[], matches: TMatchesByLine): IVisitorSummary {
  const available = lines.filter((line) => !line.sold);
  return {
    count: available.filter((line) => (matches.get(line.id)?.missingInDecks ?? 0) > 0).length,
    total: available.length,
  };
}

export function hasAvailableLines(lines: readonly ISharedListLine[]): boolean {
  return lines.some((line) => !line.sold);
}
