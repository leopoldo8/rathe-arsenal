import type { IMissingLine, IMissingSummary } from '../../api/missing-list';

export type TChip = 'buy' | 'lacks' | 'offSite' | 'owned' | 'standIn' | 'noPrice' | 'lookingUp';
export type TSide = 'all' | 'deck' | 'inventory';

export const CHIP_ORDER: readonly TChip[] = ['buy', 'lacks', 'offSite', 'owned', 'standIn', 'noPrice', 'lookingUp'];

/** Copies of the line the deck still needs, the inventory's included. */
export function neededCopies(line: Pick<IMissingLine, 'deckNeeded' | 'inventoryNeeded'>): number {
  return line.deckNeeded + line.inventoryNeeded;
}

function availableOf(line: IMissingLine): number {
  return line.availableCopies ?? 0;
}

export function lineInChip(line: IMissingLine, chip: TChip): boolean {
  const needed = neededCopies(line);
  switch (chip) {
    case 'buy':
      // A card the owner just covered with a stand-in stays here, so "Desfazer" is where the owner left it.
      return (needed > 0 && (line.state === 'priced' || line.state === 'looking_up' || line.state === 'no_price')) || line.standIn?.used === true;
    case 'lacks':
      return needed > 0 && (line.state === 'store_lacks' || (line.state === 'priced' && availableOf(line) < needed));
    case 'offSite':
      return needed > 0 && line.state === 'not_on_site';
    case 'owned':
      return line.ownedTotal > 0;
    case 'standIn':
      return line.standIn?.used === true;
    case 'noPrice':
      return needed > 0 && line.state === 'no_price';
    case 'lookingUp':
      return needed > 0 && line.state === 'looking_up';
  }
}

function copiesIn(lines: readonly IMissingLine[], state: IMissingLine['state']): number {
  return lines.filter((line) => line.state === state).reduce((sum, line) => sum + neededCopies(line), 0);
}

export function chipCount(chip: TChip, summary: IMissingSummary, lines: readonly IMissingLine[]): number {
  switch (chip) {
    case 'buy':
      return summary.buyCopies;
    case 'lacks':
      return summary.lacksCopies;
    case 'offSite':
      return summary.notOnSiteCopies;
    case 'owned':
      return summary.ownedCopies;
    case 'standIn':
      return summary.standInCopies;
    case 'noPrice':
      return copiesIn(lines, 'no_price');
    case 'lookingUp':
      return copiesIn(lines, 'looking_up');
  }
}

/** The price chips show only while a line of that kind exists; the other five always show. */
export function visibleChips(lines: readonly IMissingLine[]): readonly TChip[] {
  return CHIP_ORDER.filter((chip) => {
    if (chip === 'noPrice') return lines.some((line) => lineInChip(line, 'noPrice'));
    if (chip === 'lookingUp') return lines.some((line) => lineInChip(line, 'lookingUp'));
    return true;
  });
}

/** "Comprar na loja" when it has rows, else the first chip that does. */
export function defaultChip(lines: readonly IMissingLine[]): TChip {
  return CHIP_ORDER.find((chip) => lines.some((line) => lineInChip(line, chip))) ?? 'buy';
}

export function lineOnSide(line: IMissingLine, side: TSide): boolean {
  if (side === 'deck') return line.deckNeeded > 0;
  if (side === 'inventory') return line.inventoryNeeded > 0;
  return true;
}

export function hasInventoryCopies(lines: readonly IMissingLine[]): boolean {
  return lines.some((line) => line.inventoryNeeded > 0);
}

/** Copies missing in all, split by where they belong, and the distinct cards behind them. */
export function missingTotals(lines: readonly IMissingLine[]): { copies: number; cards: number; deck: number; inventory: number } {
  const open = lines.filter((line) => neededCopies(line) > 0);
  return {
    copies: open.reduce((sum, line) => sum + neededCopies(line), 0),
    cards: open.length,
    deck: open.reduce((sum, line) => sum + line.deckNeeded, 0),
    inventory: open.reduce((sum, line) => sum + line.inventoryNeeded, 0),
  };
}

/** The copies to buy at the store split by side: a card's deck copies are bought before its inventory copies. */
export function buySplit(lines: readonly IMissingLine[]): { deck: number; inventory: number } {
  let deck = 0;
  let inventory = 0;
  for (const line of lines) {
    if (line.state !== 'priced') continue;
    const available = availableOf(line);
    const deckShare = Math.min(available, line.deckNeeded);
    deck += deckShare;
    inventory += available - deckShare;
  }
  return { deck, inventory };
}

export function pricedLines(lines: readonly IMissingLine[]): readonly IMissingLine[] {
  return lines.filter((line) => line.state === 'priced' && availableOf(line) > 0);
}
