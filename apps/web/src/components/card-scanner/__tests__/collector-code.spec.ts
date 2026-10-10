import type { ICollectorCodesResponse } from '../../../api/collector-codes';
import { buildCollectorCodeIndex, resolveCollectorCode } from '../collector-code';

const RESPONSE: ICollectorCodesResponse = {
  imageSmallBase: 'https://cdn.test/small/',
  cards: [
    { cardIdentifier: 'blessing-of-qi-blue', name: 'Blessing of Qi', pitch: 3, printings: [{ code: 'MST172' }] },
    { cardIdentifier: 'nimblism-red', name: 'Nimblism', pitch: 1, printings: [{ code: 'WTR218' }] },
    { cardIdentifier: 'monolith-red', name: 'Monolith', pitch: 1, printings: [{ code: 'MON042' }] },
    { cardIdentifier: 'mono-four-red', name: 'Mono Four', pitch: 1, printings: [{ code: 'MON004' }] },
    { cardIdentifier: 'wtr-185', name: 'Wtr 185', pitch: 1, printings: [{ code: 'WTR185' }] },
    { cardIdentifier: 'ele-51', name: 'Ele 51', pitch: 1, printings: [{ code: 'ELE051' }] },
    { cardIdentifier: 'ele-57', name: 'Ele 57', pitch: 1, printings: [{ code: 'ELE057' }] },
    { cardIdentifier: 'arc-97', name: 'Arc 97', pitch: 1, printings: [{ code: 'ARC097' }] },
    { cardIdentifier: 'crane-dance-yellow', name: 'Crane Dance', pitch: 2, printings: [{ code: '1HP108' }] },
    { cardIdentifier: 'a-drop-in-the-ocean-blue', name: 'A Drop in the Ocean', pitch: 3, printings: [{ code: 'MST095' }] },
    { cardIdentifier: 'inner-chi-blue', name: 'Inner Chi', pitch: 3, printings: [{ code: 'MST095', image: 'MST095_BACK' }] },
    {
      cardIdentifier: 'digits-card',
      name: 'Digits',
      pitch: null,
      printings: ['MST100', 'MST101', 'MST105', 'MST102', 'MST108', 'MST106'].map((code) => ({ code })),
    },
    {
      cardIdentifier: 'letters-card',
      name: 'Letters',
      pitch: null,
      printings: ['OUT227', 'IRA001', 'SEA156', 'ZEN001', 'BRI001', 'GEM119', 'BOS001', 'GIZ001'].map((code) => ({ code })),
    },
  ],
};

const INDEX = buildCollectorCodeIndex(RESPONSE);

function resolvedCode(text: string): string | null {
  return resolveCollectorCode(text, INDEX)?.code ?? null;
}

describe('resolveCollectorCode', () => {
  it('resolves MSTI72 to MST172', () => {
    const result = resolveCollectorCode('EN | MSTI72 Faizal Fikri', INDEX);

    expect(result?.code).toBe('MST172');
    expect(result?.cards.map((card) => card.cardIdentifier)).toEqual(['blessing-of-qi-blue']);
  });

  it('resolves the legacy WTR218-C layout', () => {
    const result = resolveCollectorCode('WTR218-C Fedor Barkhatov', INDEX);

    expect(result?.code).toBe('WTR218');
    expect(result?.cards.map((card) => card.cardIdentifier)).toEqual(['nimblism-red']);
  });

  it.each([
    ['IAD © MoNo042 Phu Thieu', 'MON042'],
    ['IAP @ MONO042 Phu Thieu', 'MON042'],
    ['EN | MON0042 Phu Thieu', 'MON042'],
  ])('drops a doubled first digit: %s -> %s', (text, expected) => {
    expect(resolvedCode(text)).toBe(expected);
  });

  it('reads T as 7 when only that code exists', () => {
    expect(resolvedCode('EN | ARC09T Artist')).toBe('ARC097');
  });

  it('skips a T that could be 1 or 7 when both codes exist', () => {
    expect(resolvedCode('7" @) ELEOST Faizal Fikri')).toBeNull();
  });

  it.each([['EN | WTR2185 Artist'], ['EN | MON0049 Artist']])(
    'does not read a code that runs into another digit: %s',
    (text) => {
      expect(resolvedCode(text)).toBeNull();
    },
  );

  it('keeps a digit-led set code', () => {
    const result = resolveCollectorCode('Nl (R) 1HP108 Asep Ariyanto © 2021', INDEX);

    expect(result?.code).toBe('1HP108');
    expect(result?.cards.map((card) => card.cardIdentifier)).toEqual(['crane-dance-yellow']);
  });

  it.each([
    ['MSTI00', 'MST100'],
    ['MST1O0', 'MST100'],
    ['MST1Q0', 'MST100'],
    ['MST1D0', 'MST100'],
    ['MST10I', 'MST101'],
    ['MST10L', 'MST101'],
    ['MST10T', 'MST101'],
    ['MST10|', 'MST101'],
    ['MST10S', 'MST105'],
    ['MST10Z', 'MST102'],
    ['MST10B', 'MST108'],
    ['MST10G', 'MST106'],
    ['0UT227', 'OUT227'],
    ['1RA001', 'IRA001'],
    ['5EA156', 'SEA156'],
    ['2EN001', 'ZEN001'],
    ['8RI001', 'BRI001'],
    ['6EM119', 'GEM119'],
    ['B05001', 'BOS001'],
    ['G12001', 'GIZ001'],
  ])('normalizes every confusion in the table: %s -> %s', (text, expected) => {
    expect(resolvedCode(`EN | ${text} Artist`)).toBe(expected);
  });

  it.each([['Legend Story Studios'], ['EN | ABC999 Artist'], ['']])(
    'returns no match when no token is an indexed code: "%s"',
    (text) => {
      expect(resolveCollectorCode(text, INDEX)).toBeNull();
    },
  );

  it('returns both cards of a double-faced code', () => {
    const result = resolveCollectorCode('EN | MST095 Artist', INDEX);

    expect(result?.cards.map((card) => card.cardIdentifier)).toEqual([
      'a-drop-in-the-ocean-blue',
      'inner-chi-blue',
    ]);
    expect(result?.cards.map((card) => card.imageSmall)).toEqual([
      'https://cdn.test/small/MST095.webp',
      'https://cdn.test/small/MST095_BACK.webp',
    ]);
  });
});
