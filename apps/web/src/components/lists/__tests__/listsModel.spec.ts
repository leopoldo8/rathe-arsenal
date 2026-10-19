import { describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { makeLine, makeList, makeSummary } from './listsTestKit';
import {
  buildListText,
  formatBrl,
  formatMoneyInput,
  groupListsByKind,
  listMeta,
  listTotals,
  makeTranslate,
  parseMoney,
  updatedLabel,
} from '../listsModel';

const t = makeTranslate(i18n.getFixedT('pt-BR'));
const NOW = new Date('2026-10-19T15:00:00.000Z').getTime();

describe('parseMoney', () => {
  it.each([
    ['6', 600],
    ['6,5', 650],
    ['6,50', 650],
    ['6.50', 650],
    ['R$ 6,00', 600],
    ['1.420,50', 142050],
    ['1.420', 142000],
    ['0', 0],
  ])('reads %s as %i cents', (raw, cents) => {
    expect(parseMoney(raw)).toEqual({ valid: true, cents });
  });

  it('treats an empty field as no price', () => {
    expect(parseMoney('  ')).toEqual({ valid: true, cents: null });
  });

  it.each(['abc', '6,505', '-3', '6,5,0', '99999999999'])('rejects %s', (raw) => {
    expect(parseMoney(raw)).toEqual({ valid: false });
  });
});

describe('money formatting', () => {
  it('writes reais with a plain space and a decimal comma', () => {
    expect(formatBrl(600)).toBe('R$ 6,00');
    expect(formatBrl(142050)).toBe('R$ 1.420,50');
  });

  it('fills an input without the symbol or thousands separator', () => {
    expect(formatMoneyInput(142050)).toBe('1420,50');
    expect(formatMoneyInput(null)).toBe('');
  });
});

describe('groupListsByKind', () => {
  it('splits the lists into wanted and for sale, keeping order', () => {
    const lists = [
      makeSummary({ id: 1, kind: 'want' }),
      makeSummary({ id: 2, kind: 'sell' }),
      makeSummary({ id: 3, kind: 'want' }),
    ];
    const groups = groupListsByKind(lists);
    expect(groups.want.map((list) => list.id)).toEqual([1, 3]);
    expect(groups.sell.map((list) => list.id)).toEqual([2]);
  });
});

describe('listMeta and updatedLabel', () => {
  it('counts cards, sold cards and freshness', () => {
    const summary = makeSummary({ kind: 'sell', copyCount: 15, soldCount: 1, updatedAt: '2026-10-19T09:00:00.000Z' });
    expect(listMeta(summary, t, NOW)).toBe('15 cartas · 1 vendida · atualizada hoje');
  });

  it('leaves sold out of a want list', () => {
    const summary = makeSummary({ kind: 'want', copyCount: 3, soldCount: 0, updatedAt: '2026-10-07T09:00:00.000Z' });
    expect(listMeta(summary, t, NOW)).toBe('3 cartas · atualizada há 1 semana');
  });

  it.each([
    ['2026-10-18T09:00:00.000Z', 'atualizada ontem'],
    ['2026-10-14T09:00:00.000Z', 'atualizada há 5 dias'],
    ['2026-09-10T09:00:00.000Z', 'atualizada há 1 mês'],
  ])('labels %s', (iso, expected) => {
    expect(updatedLabel(iso, t, NOW)).toBe(expected);
  });
});

describe('listTotals', () => {
  it('sums copies and separates the sold ones', () => {
    const totals = listTotals([makeLine({ quantity: 2 }), makeLine({ id: 2, quantity: 3, sold: true })]);
    expect(totals).toEqual({ cards: 5, sold: 3, available: 2 });
  });
});

describe('buildListText', () => {
  it('writes a want list one card per line with the pitch named', () => {
    const list = makeList({
      kind: 'want',
      lines: [
        makeLine({ quantity: 2, name: 'Pummel', pitch: 1 }),
        makeLine({ id: 2, quantity: 1, name: 'Tome of Fyendal', pitch: null }),
      ],
    });
    expect(buildListText(list, t)).toBe('2x Pummel (Vermelho)\n1x Tome of Fyendal');
  });

  it('writes a sell list with condition and price, leaving blanks and sold cards out', () => {
    const list = makeList({
      totalPriceCents: 42000,
      lines: [
        makeLine({ id: 1, quantity: 2, condition: 'NM', priceCents: 600 }),
        makeLine({ id: 2, quantity: 3, name: 'Razor Reflex', pitch: 2, condition: 'LP' }),
        makeLine({ id: 3, quantity: 1, name: 'Crippling Crush', pitch: 3, priceCents: 900 }),
        makeLine({ id: 4, quantity: 1, name: 'Snatch', pitch: 1 }),
        makeLine({ id: 5, quantity: 1, name: 'Remembrance', pitch: null, condition: 'MP', priceCents: 5500, sold: true }),
      ],
    });
    expect(buildListText(list, t)).toBe(
      [
        '2x Pummel (Vermelho) · NM · R$ 6,00 cada',
        '3x Razor Reflex (Amarelo) · LP',
        '1x Crippling Crush (Azul) · R$ 9,00 cada',
        '1x Snatch (Vermelho)',
        '',
        'Total: R$ 420,00',
      ].join('\n'),
    );
  });

  it('adds no total line when the list has none', () => {
    const list = makeList({ lines: [makeLine({ priceCents: 600 })] });
    expect(buildListText(list, t)).toBe('2x Pummel (Vermelho) · R$ 6,00 cada');
  });
});

describe('card count wording', () => {
  it('says "0 cartas" for an empty list, where pt-BR plural rules would pick the singular', () => {
    expect(i18n.t('lists.bar.cards', { count: 0 })).toBe('0 cartas');
    expect(i18n.t('lists.cardCount', { count: 0 })).toBe('0 cartas');
    expect(i18n.t('lists.bar.cards', { count: 1 })).toBe('1 carta');
  });
});
