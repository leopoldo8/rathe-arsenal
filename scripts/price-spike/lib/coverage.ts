import { foilingToSubType, priceKey } from './tcgcsv';
import type { ICardCoverage, ICardSetEntry, ICardSetPrinting, IPriceRow } from './types';

export function computeCoverage(
  cardSet: readonly ICardSetEntry[],
  index: ReadonlyMap<string, IPriceRow>,
): ICardCoverage[] {
  return cardSet.map((card) => {
    const priced = card.printings.flatMap((printing) => {
      if (printing.productId === null) return [];
      const row = index.get(priceKey(printing.productId, foilingToSubType(printing.foiling, printing.edition)));
      return row && row.marketPrice !== null ? [{ printing, row }] : [];
    });
    const normal = priced.find((p) => p.printing.foiling === 'Standard');
    return {
      cardIdentifier: card.cardIdentifier,
      name: card.name,
      printingsTotal: card.printings.length,
      printingsPriced: priced.length,
      best: normal ?? priced[0] ?? null,
    };
  });
}

export type TPrintingStatus = 'priced' | 'no-product-id' | 'no-price-row' | 'market-null';

export function classifyPrinting(
  printing: ICardSetPrinting,
  index: ReadonlyMap<string, IPriceRow>,
): TPrintingStatus {
  if (printing.productId === null) return 'no-product-id';
  const row = index.get(priceKey(printing.productId, foilingToSubType(printing.foiling, printing.edition)));
  if (!row) return 'no-price-row';
  return row.marketPrice === null ? 'market-null' : 'priced';
}

export function countPrintingStatuses(
  cardSet: readonly ICardSetEntry[],
  index: ReadonlyMap<string, IPriceRow>,
): Record<TPrintingStatus, number> {
  const counts: Record<TPrintingStatus, number> = { priced: 0, 'no-product-id': 0, 'no-price-row': 0, 'market-null': 0 };
  for (const card of cardSet) for (const printing of card.printings) counts[classifyPrinting(printing, index)] += 1;
  return counts;
}

export function summarize(coverage: readonly ICardCoverage[]): {
  cards: number;
  cardsPriced: number;
  printings: number;
  printingsPriced: number;
} {
  return {
    cards: coverage.length,
    cardsPriced: coverage.filter((c) => c.best !== null).length,
    printings: coverage.reduce((sum, c) => sum + c.printingsTotal, 0),
    printingsPriced: coverage.reduce((sum, c) => sum + c.printingsPriced, 0),
  };
}
