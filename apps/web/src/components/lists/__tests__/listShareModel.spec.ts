import { describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { buildListShareMessage } from '../listShareModel';
import { buildListText, makeTranslate } from '../listsModel';
import { makeLine, makeList } from './listsTestKit';

const t = makeTranslate(i18n.getFixedT('pt-BR'));
const URL = 'https://rathearsenal.app/l/aB3dE5gH7jK9mN';

describe('buildListShareMessage', () => {
  it('lists a want list as text, then the address', () => {
    const list = makeList({
      kind: 'want',
      lines: [makeLine({ id: 1, quantity: 3 }), makeLine({ id: 2, name: 'Tome of Fyendal', pitch: null, quantity: 1 })],
    });

    expect(buildListShareMessage(list, URL, t)).toBe(
      `Comprando essas cartas:\n3x Pummel (Vermelho)\n1x Tome of Fyendal\n\n${URL}`,
    );
  });

  it('writes sell lines with condition and price, leaves blanks and sold cards out, and ends with the set price', () => {
    const list = makeList({
      kind: 'sell',
      totalPriceCents: 42000,
      lines: [
        makeLine({ id: 1, quantity: 1, condition: 'NM', priceCents: 600 }),
        makeLine({ id: 2, name: 'Snatch', quantity: 2 }),
        makeLine({ id: 3, name: 'Remembrance', pitch: null, sold: true, priceCents: 5500 }),
      ],
    });

    expect(buildListShareMessage(list, URL, t)).toBe(
      `Vendendo essas cartas:\n1x Pummel (Vermelho) · NM · R$ 6,00 cada\n2x Snatch (Vermelho)\n\nTudo por R$ 420,00\n\n${URL}`,
    );
  });

  it('stops at 30 card lines and counts the cards left in the link', () => {
    const lines = Array.from({ length: 33 }, (_, index) =>
      makeLine({ id: index + 1, cardIdentifier: `card-${index}`, name: `Card ${index + 1}`, pitch: null, quantity: index >= 30 ? 2 : 1 }),
    );

    const message = buildListShareMessage(makeList({ kind: 'want', lines }), URL, t).split('\n');

    expect(message).toHaveLength(1 + 30 + 1 + 2);
    expect(message[30]).toBe('1x Card 30');
    expect(message[31]).toBe('e mais 6 cartas no link');
    expect(message.at(-1)).toBe(URL);
  });

  it('does not count sold cards against the 30 lines', () => {
    const lines = [
      ...Array.from({ length: 5 }, (_, index) => makeLine({ id: 100 + index, name: `Sold ${index}`, pitch: null, sold: true })),
      ...Array.from({ length: 30 }, (_, index) => makeLine({ id: index + 1, name: `Card ${index + 1}`, pitch: null })),
    ];

    const message = buildListShareMessage(makeList({ kind: 'sell', lines }), URL, t);

    expect(message).not.toContain('Sold');
    expect(message).not.toContain('e mais');
  });
});

describe('buildListText with an address', () => {
  it('puts the address after the total, and leaves the text as it was without one', () => {
    const list = makeList({ totalPriceCents: 42000, lines: [makeLine({ id: 1, quantity: 1 })] });

    expect(buildListText(list, t)).toBe('1x Pummel (Vermelho)\n\nTotal: R$ 420,00');
    expect(buildListText(list, t, URL)).toBe(`1x Pummel (Vermelho)\n\nTotal: R$ 420,00\n\n${URL}`);
  });
});
