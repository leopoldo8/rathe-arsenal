import { describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import type { ISharedQuoteItem } from '../../../api/shared-decks';
import { buildQuoteMessage, buildSpreadsheetList, parseReais, quoteTotals } from '../quoteMessage';
import type { TQuoteDraft } from '../quoteDraft';

const t = i18n.t.bind(i18n);

const NEEDED: readonly ISharedQuoteItem[] = [
  { cardIdentifier: 'alpha-rampage-red', name: 'Alpha Rampage', pitch: 1, imageUrl: null, quantity: 1 },
  { cardIdentifier: 'bloodrush-bellow-yellow', name: 'Bloodrush Bellow', pitch: 2, imageUrl: null, quantity: 3 },
  { cardIdentifier: 'nullrune-hood', name: 'Nullrune Hood', pitch: null, imageUrl: null, quantity: 2 },
  { cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1, imageUrl: null, quantity: 3 },
];

const DRAFT: TQuoteDraft = {
  'alpha-rampage-red': { have: 1, price: '120,00', note: 'Edição promo, condição NM' },
  'bloodrush-bellow-yellow': { have: 2, price: '60,00', note: '' },
  'nullrune-hood': { have: 0, price: '15,00', note: 'ignored' },
  'pack-hunt-red': { have: 3, price: '', note: '' },
};

describe('parseReais', () => {
  it.each([
    ['120,00', 12000],
    ['8', 800],
    ['2,5', 250],
    ['1.200,00', 120000],
    [' 7,99 ', 799],
    ['', null],
    ['abc', null],
    ['-3', null],
  ])('reads %j as %j cents', (text, cents) => {
    expect(parseReais(text)).toBe(cents);
  });
});

describe('quoteTotals', () => {
  it('counts the copies marked and prices only the rows that carry a price', () => {
    expect(quoteTotals(NEEDED, DRAFT)).toEqual({ have: 6, needed: 9, cents: 12000 + 2 * 6000 });
  });
});

describe('buildQuoteMessage', () => {
  it('builds the quote message from the rows with a quantity', () => {
    const message = buildQuoteMessage({ sharerName: 'Caio', deckName: '[CC] Brute do Caio', needed: NEEDED, draft: DRAFT }, t);

    expect(message).toBe(
      [
        'Oi Caio, orçamento para o seu deck [CC] Brute do Caio:',
        '1x Alpha Rampage (Vermelho) · R$ 120,00 cada · Edição promo, condição NM',
        '2x Bloodrush Bellow (Amarelo) · R$ 60,00 cada',
        '3x Pack Hunt (Vermelho)',
        'Total: 6 de 9 cópias · R$ 240,00',
      ].join('\n'),
    );
    expect(message).not.toMatch(/Nullrune|C[uú]pula/);
  });
});

describe('buildSpreadsheetList', () => {
  it('copies a tab-separated list for a spreadsheet', () => {
    expect(buildSpreadsheetList(NEEDED, t)).toBe(
      ['1\tAlpha Rampage\tVermelho', '3\tBloodrush Bellow\tAmarelo', '2\tNullrune Hood\t', '3\tPack Hunt\tVermelho'].join('\n'),
    );
  });
});
