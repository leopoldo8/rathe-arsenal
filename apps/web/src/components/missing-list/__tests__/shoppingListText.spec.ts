import { describe, it, expect } from 'vitest';
import i18n from '../../../i18n';
import { buildShoppingListText } from '../shoppingListText';
import { line } from './missingListKit';

describe('buildShoppingListText', () => {
  it('builds the shopping list from the priced rows', () => {
    const lines = [
      line({ cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1, unitPriceCents: 20, availableCopies: 3, lineCents: 60 }),
      line({ cardIdentifier: 'alpha-rampage-red', name: 'Alpha Rampage', pitch: 1, deckNeeded: 1, unitPriceCents: 15000, availableCopies: 1, lineCents: 15000, foilOnly: true, promoOnly: true }),
      line({ cardIdentifier: 'bloodrush-bellow-yellow', name: 'Bloodrush Bellow', pitch: 2, unitPriceCents: 6999, availableCopies: 2, lineCents: 13998 }),
      line({ cardIdentifier: 'x', state: 'looking_up', unitPriceCents: null, lineCents: null, availableCopies: null }),
      line({ cardIdentifier: 'y', state: 'store_lacks', unitPriceCents: null, lineCents: null, availableCopies: null }),
    ];

    const text = buildShoppingListText(lines, '[CC] Brute do Caio', 'Rhinar', i18n.t.bind(i18n));

    expect(text.split('\n')).toEqual([
      'Lista de compras · [CC] Brute do Caio (Rhinar) · Cúpula DT',
      '3x Pack Hunt (Vermelho) · R$ 0,20 cada',
      '1x Alpha Rampage (Vermelho) · R$ 150,00 cada · foil promo',
      '2x Bloodrush Bellow (Amarelo) · R$ 69,99 cada',
      'Total: 6 cópias · R$ 290,58',
    ]);
  });
});
