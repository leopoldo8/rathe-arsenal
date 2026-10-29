import { describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { buildGroupAskMessage, groupAskCounts, type IGroupAskCard, type IGroupAskInput } from '../groupAskMessage';

const t = i18n.t.bind(i18n);

function card(overrides: Partial<IGroupAskCard> & Pick<IGroupAskCard, 'name' | 'quantity' | 'state'>): IGroupAskCard {
  return { cardIdentifier: overrides.name.toLowerCase(), pitch: null, availableCopies: null, inventoryQuantity: 0, ...overrides };
}

const CARDS: readonly IGroupAskCard[] = [
  card({ name: 'Reckless Swing', pitch: 3, quantity: 3, state: 'store_lacks' }),
  card({ name: 'Bloodrush Bellow', pitch: 2, quantity: 3, state: 'priced', availableCopies: 2 }),
  card({ name: 'Snapdragon Scalers', quantity: 1, state: 'not_on_site' }),
  card({ name: 'Crater Fist', quantity: 1, state: 'not_on_site' }),
  card({ name: 'Alpha Rampage', pitch: 1, quantity: 1, state: 'priced', availableCopies: 1 }),
  card({ name: 'Pack Hunt', pitch: 1, quantity: 3, state: 'looking_up' }),
  card({ name: 'Savage Swing', pitch: 1, quantity: 2, state: 'no_price' }),
];

const URL = 'https://rathe-arsenal.app/d/k7x2';

function input(overrides: Partial<IGroupAskInput> = {}): IGroupAskInput {
  return {
    deckName: '[CC] Brute do Caio',
    hero: 'Rhinar, Reckless Rampage',
    url: URL,
    cards: CARDS,
    closingLine: 'Pago no PIX ou troco. Estou em Pelotas.',
    includeStoreSide: false,
    ...overrides,
  };
}

describe('buildGroupAskMessage', () => {
  it('lists only what the store cannot supply', () => {
    const message = buildGroupAskMessage(input(), t);

    expect(message).toBe(
      [
        'Procuro estas cartas para o meu deck [CC] Brute do Caio (Rhinar):',
        '3 Reckless Swing (Azul)',
        '1 Bloodrush Bellow (Amarelo)',
        '',
        'Também procuro: 1 Snapdragon Scalers, 1 Crater Fist.',
        '',
        'Pago no PIX ou troco. Estou em Pelotas.',
        '',
        `Lista completa: ${URL}`,
      ].join('\n'),
    );
    expect(message).not.toMatch(/Alpha Rampage|Pack Hunt|Savage Swing/);
  });

  it('leaves out the closing line and the also-looking line when there is nothing to put there', () => {
    const message = buildGroupAskMessage(
      input({ closingLine: '', cards: [card({ name: 'Reckless Swing', pitch: 3, quantity: 2, state: 'store_lacks' })] }),
      t,
    );

    expect(message).toBe(
      ['Procuro estas cartas para o meu deck [CC] Brute do Caio (Rhinar):', '2 Reckless Swing (Azul)', '', `Lista completa: ${URL}`].join('\n'),
    );
  });

  it('cuts the list at 30 lines and counts the copies left in the link', () => {
    const many = Array.from({ length: 35 }, (_, index) =>
      card({ name: `Card ${String(index + 1).padStart(2, '0')}`, quantity: 1, state: 'store_lacks' }),
    );

    const lines = buildGroupAskMessage(input({ cards: many, closingLine: '' }), t).split('\n');

    expect(lines.filter((line) => /^1 Card /.test(line))).toHaveLength(30);
    expect(lines).toContain('e mais 5 cartas no link');
    expect(lines).not.toContain('1 Card 31');
  });

  it('names the split next to a card that has copies in the inventory', () => {
    const message = buildGroupAskMessage(
      input({ cards: [card({ name: 'Pack Hunt', pitch: 1, quantity: 7, inventoryQuantity: 3, state: 'store_lacks' })], closingLine: '' }),
      t,
    );

    expect(message).toContain('7 Pack Hunt (Vermelho) (4 do deck, 3 do inventário)');
  });

  it('the store-side cards are added only when asked', () => {
    const off = buildGroupAskMessage(input(), t);
    const on = buildGroupAskMessage(input({ includeStoreSide: true }), t);

    expect(off).not.toContain('Na Cúpula DT tem');
    expect(on).toContain(
      [
        'Na Cúpula DT tem, mas também aceito:',
        '2 Bloodrush Bellow (Amarelo)',
        '1 Alpha Rampage (Vermelho)',
        '3 Pack Hunt (Vermelho)',
        '2 Savage Swing (Vermelho)',
      ].join('\n'),
    );
    expect(groupAskCounts(CARDS)).toEqual({ asked: 3 + 1 + 1 + 1, storeSide: 2 + 1 + 3 + 2 });
  });
});
