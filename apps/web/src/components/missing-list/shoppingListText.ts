import type { TFunction } from 'i18next';
import type { IMissingLine } from '../../api/missing-list';
import { cardName } from '../../lib/card-name';
import { formatBrl } from '../../utils/format-brl';
import { pricedLines } from './missingListModel';

function finishNote(line: IMissingLine, t: TFunction): string | null {
  if (line.foilOnly && line.promoOnly) return t('missingList.shoppingListFoilPromo');
  if (line.foilOnly) return t('missingList.shoppingListFoil');
  if (line.promoOnly) return t('missingList.shoppingListPromo');
  return null;
}

/**
 * The shopping list as text to paste: the priced rows only, the copies the store can supply, each card
 * named with its pitch as a word.
 */
export function buildShoppingListText(
  lines: readonly IMissingLine[],
  deckName: string,
  heroName: string,
  t: TFunction,
): string {
  const rows = pricedLines(lines);
  const body = rows.map((line) => {
    const note = finishNote(line, t);
    const parts = [
      t('missingList.shoppingListLine', {
        count: line.availableCopies ?? 0,
        name: cardName(line.name, line.pitch, t),
        price: formatBrl(line.unitPriceCents ?? 0),
      }),
      ...(note === null ? [] : [note]),
    ];
    return parts.join(' · ');
  });
  const copies = rows.reduce((sum, line) => sum + (line.availableCopies ?? 0), 0);
  const cents = rows.reduce((sum, line) => sum + (line.lineCents ?? 0), 0);
  return [
    t('missingList.shoppingListTitle', { deck: deckName, hero: heroName }),
    ...body,
    t('missingList.shoppingListTotal', { count: copies, price: formatBrl(cents) }),
  ].join('\n');
}
