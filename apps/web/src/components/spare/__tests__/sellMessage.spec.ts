import { describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { buildSellMessage, finishWords, type ISellLine } from '../sellMessage';

const t = i18n.t.bind(i18n);

function line(overrides: Partial<ISellLine>): ISellLine {
  return {
    quantity: 1,
    name: 'Snatch',
    pitch: 1,
    priceReais: 6,
    setName: null,
    printingCode: '',
    edition: '',
    finish: '',
    condition: '',
    foilFinishes: ['rainbow'],
    answer: null,
    ...overrides,
  };
}

/** Duda's draft: the five lines of `r3-message-phone`, the three with no finish answered "Sem foil" in the mockup. */
function dudaLines(answer: ISellLine['answer'] = 'none'): ISellLine[] {
  return [
    line({ quantity: 2, name: 'Command and Conquer', priceReais: 45, setName: 'History Pack 1', printingCode: 'HP1001', condition: 'NM', foilFinishes: [] }),
    line({ quantity: 1, name: 'Enlightened Strike', priceReais: 60, finish: 'rainbow', condition: 'NM' }),
    line({ quantity: 1, name: 'Enlightened Strike', priceReais: 12, answer }),
    line({ quantity: 2, name: 'Snatch', priceReais: 6, answer }),
    line({ quantity: 3, name: 'Pummel', priceReais: 4, answer }),
  ];
}

const CLOSING = 'Aceito PIX · retirada na loja do centro ou envio pelos Correios';
const LINK = 'https://rathearsenal.app/l/k7Qm2x';

describe('sell message', () => {
  it('builds Duda\'s message exactly', () => {
    const message = buildSellMessage({ lines: dudaLines(), includeTotal: true, closingLine: CLOSING, link: LINK }, t);

    expect(message.split('\n')).toEqual([
      'VENDO',
      '2x Command and Conquer (Vermelho) · History Pack 1 · NM · R$ 45 cada',
      '1x Enlightened Strike (Vermelho) · Rainbow Foil · NM · R$ 60',
      '1x Enlightened Strike (Vermelho) · sem foil · R$ 12',
      '2x Snatch (Vermelho) · sem foil · R$ 6 cada',
      '3x Pummel (Vermelho) · sem foil · R$ 4 cada',
      'Total: R$ 186 (9 cartas)',
      '',
      CLOSING,
      LINK,
    ]);
  });

  it('every finish answer has its words in the message', () => {
    const words = (answer: ISellLine['answer'], extra: Partial<ISellLine> = {}): string | null => finishWords(line({ answer, ...extra }), t);

    expect(words('none')).toBe('sem foil');
    expect(words('unknown')).toBe('foil não conferido');
    expect(words(null)).toBe('foil não conferido');
    expect(words('foil')).toBe('Rainbow Foil');
    expect(words('foil', { foilFinishes: ['rainbow', 'cold'] })).toBe('foil');
    // A card that exists in no foil leaves the draft with neither word, and a known finish speaks for itself.
    expect(words(null, { foilFinishes: [] })).toBeNull();
    expect(words(null, { finish: 'cold' })).toBe('Cold Foil');
    expect(words(null, { finish: 'none' })).toBe('sem foil');

    const unanswered = buildSellMessage({ lines: [line({ answer: null })], includeTotal: false, closingLine: '', link: LINK }, t);
    expect(unanswered).toContain('1x Snatch (Vermelho) · foil não conferido · R$ 6');
  });

  it('caps at 30 lines and the total counts every line', () => {
    const lines = Array.from({ length: 35 }, (_, index) => line({ name: `Card ${index}`, priceReais: 2, foilFinishes: [] }));

    const message = buildSellMessage({ lines, includeTotal: true, closingLine: '', link: LINK }, t).split('\n');

    expect(message.filter((entry) => /^1x Card/.test(entry))).toHaveLength(30);
    expect(message).toContain('e mais 5 cartas no link');
    expect(message).toContain('Total: R$ 70 (35 cartas)');
    expect(message[1]).toBe('1x Card 0 (Vermelho) · R$ 2');
  });

  it('leaves the total out when it is off, and reads one copy without "cada"', () => {
    const lines = [line({ quantity: 1, priceReais: 12.5, foilFinishes: [] }), line({ quantity: 2, name: 'Pummel', priceReais: 4, foilFinishes: [] })];

    const off = buildSellMessage({ lines, includeTotal: false, closingLine: '', link: LINK }, t);
    const on = buildSellMessage({ lines, includeTotal: true, closingLine: '', link: LINK }, t);

    expect(off).not.toContain('Total:');
    expect(off).toContain('1x Snatch (Vermelho) · R$ 12,50');
    expect(off).toContain('2x Pummel (Vermelho) · R$ 4 cada');
    expect(on).toContain('Total: R$ 20,50 (3 cartas)');
  });

  it('says "e mais 1 carta" in the singular', () => {
    const lines = Array.from({ length: 31 }, (_, index) => line({ name: `Card ${index}`, foilFinishes: [] }));

    expect(buildSellMessage({ lines, includeTotal: false, closingLine: '', link: LINK }, t)).toContain('e mais 1 carta no link');
  });
});
