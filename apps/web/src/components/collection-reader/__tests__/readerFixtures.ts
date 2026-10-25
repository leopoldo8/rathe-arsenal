import type { IReadLine } from '../../../api/collection-imports';

const NO_VERSION = { printingCode: '', edition: '', finish: '', condition: '' } as const;

export function makeLine(overrides: Partial<IReadLine> & { lineNumber: number; originalText: string }): IReadLine {
  return {
    outcome: 'ready',
    cardIdentifier: null,
    name: null,
    pitch: null,
    imageUrl: null,
    quantity: 1,
    quantityRaw: null,
    suggestedQuantity: null,
    options: null,
    suggestion: null,
    version: NO_VERSION,
    versionNote: null,
    notes: [],
    ...overrides,
  };
}

function ready(lineNumber: number, originalText: string, quantity: number, cardIdentifier: string, name: string, pitch: number, extra: Partial<IReadLine> = {}): IReadLine {
  return makeLine({ lineNumber, originalText, quantity, cardIdentifier, name, pitch, ...extra });
}

export const LIST_PASTE = [
  '3x Snatch (Red)',
  '2 Command and Conquer vermelho',
  '1 Enlightened Strike foil',
  'comand and conquer',
  '4 Pummel',
  'Sink Below (Amarelo) x2',
  '3x Pack Hunt (3)',
  'Mistery Card',
].join('\n');

/** The eight lines of `r3-list-phone` as the reader answers them. */
export const LIST_LINES: readonly IReadLine[] = [
  ready(1, '3x Snatch (Red)', 3, 'snatch-red', 'Snatch', 1),
  ready(2, '2 Command and Conquer vermelho', 2, 'command-and-conquer-red', 'Command and Conquer', 1),
  ready(3, '1 Enlightened Strike foil', 1, 'enlightened-strike-red', 'Enlightened Strike', 1, {
    versionNote: 'foil · existe em 2 versões foil: escolha',
  }),
  makeLine({
    lineNumber: 4,
    originalText: 'comand and conquer',
    outcome: 'suggestion',
    suggestion: { cardIdentifier: 'command-and-conquer-red', name: 'Command and Conquer', pitch: 1, imageUrl: null },
  }),
  makeLine({
    lineNumber: 5,
    originalText: '4 Pummel',
    outcome: 'asks_color',
    name: 'Pummel',
    quantity: 4,
    options: [
      { kind: 'pitch', pitch: 1, cardIdentifier: 'pummel-red' },
      { kind: 'pitch', pitch: 2, cardIdentifier: 'pummel-yellow' },
      { kind: 'pitch', pitch: 3, cardIdentifier: 'pummel-blue' },
      { kind: 'unknown' },
    ],
  }),
  ready(6, 'Sink Below (Amarelo) x2', 2, 'sink-below-yellow', 'Sink Below', 2),
  ready(7, '3x Pack Hunt (3)', 3, 'pack-hunt-blue', 'Pack Hunt', 3, { notes: ['"(3)" lido como Azul'] }),
  makeLine({ lineNumber: 8, originalText: 'Mistery Card', outcome: 'not_found' }),
];
