import { catalog } from '@rathe-arsenal/engine';
import { CatalogCardLookup } from '../catalog-card-lookup';
import { LineReader, summarizeLines } from '../line-reader';
import { ICardLookup, IRawLine, IReadLine } from '../line-reader.types';

const lookup = new CatalogCardLookup({
  getCards: () => catalog.cards,
  getCard: (identifier) => catalog.getCard(identifier),
  getRawCard: (identifier) => catalog.getRawCard(identifier),
});
const reader = new LineReader(lookup);

function readText(...lines: string[]): IReadLine[] {
  return lines.map((text, index) => reader.read({ lineNumber: index + 1, originalText: text, text }));
}

function tableRow(overrides: Partial<IRawLine> & { text: string }): IReadLine {
  return reader.read({ lineNumber: 2, originalText: overrides.text, isTable: true, ...overrides });
}

const LIST_PHONE_PASTE = [
  '3x Snatch (Red)',
  '2 Command and Conquer vermelho',
  '1 Enlightened Strike foil',
  'comand and conquer',
  '4 Pummel',
  'Sink Below (Amarelo) x2',
  '3x Pack Hunt (3)',
  'Mistery Card',
];

describe('line reader', () => {
  it('a numeric pitch is read and noted', () => {
    const [line] = readText('3x Pack Hunt (3)');

    expect(line).toMatchObject({ outcome: 'ready', cardIdentifier: 'pack-hunt-blue', quantity: 3 });
    expect(line!.notes).toContain('"(3)" lido como Azul');
  });

  it('a several-color card with no color asks which color', () => {
    const [pummel, oneColor] = readText('4 Pummel', '2 Command and Conquer');
    const withColumnEmpty = tableRow({ text: 'Pummel', quantityCell: '1', colorCell: '' });
    const oneColorWithColumnEmpty = tableRow({ text: 'Command and Conquer', quantityCell: '1', colorCell: '' });

    expect(pummel!.outcome).toBe('asks_color');
    expect(pummel!.quantity).toBe(4);
    expect(pummel!.options!.map((option) => (option.kind === 'pitch' ? option.pitch : 'unknown'))).toEqual([1, 2, 3, 'unknown']);
    expect(oneColor!.outcome).toBe('ready');
    expect(withColumnEmpty.outcome).toBe('asks_color');
    expect(oneColorWithColumnEmpty.outcome).toBe('ready');
  });

  it('one typo from exactly one card suggests it', () => {
    const [typo, twoEdits] = readText('comand and conquer', 'commmand and conqueer');
    const twoNames: ICardLookup = {
      ...lookup,
      idsByName: (name) => (name === 'abcd' ? ['a'] : name === 'abce' ? ['b'] : []),
      distinctNames: () => ['abcd', 'abce'],
      card: () => ({ name: 'x', pitch: null, imageUrl: null }),
      printings: () => [],
      matchesSet: () => false,
    };
    const ambiguous = new LineReader(twoNames).read({ lineNumber: 1, originalText: 'abcx', text: 'abcx' });

    expect(typo).toMatchObject({ outcome: 'suggestion' });
    expect(typo!.suggestion).toMatchObject({ name: 'Command and Conquer' });
    expect(typo!.suggestion!.imageUrl).not.toBeNull();
    expect(summarizeLines([typo!]).ready).toBe(0);
    expect(twoEdits!.outcome).toBe('not_found');
    expect(ambiguous.outcome).toBe('not_found');
  });

  describe('every line is counted once and quantities cap at 20', () => {
    // Index 0, 7, 14... name a card that does not exist; index 5, 10, 15... (not a multiple of 7) leave the color out.
    const csvRows = Array.from({ length: 300 }, (_unused, index) =>
      reader.read({
        lineNumber: index + 2,
        originalText: `row ${index}`,
        isTable: true,
        text: index % 7 === 0 ? 'Cartaqualquer' : index % 5 === 0 ? 'Pummel' : 'Snatch',
        quantityCell: '1',
        colorCell: index % 7 !== 0 && index % 5 === 0 ? '' : 'Vermelho',
      }),
    );

    it.each<[string, readonly IReadLine[], readonly number[], { read: number; ready: number; asked: number; kept: number }]>([
      ['the paste of r3-list-phone, with its suggestion accepted', readText(...LIST_PHONE_PASTE), [4], { read: 8, ready: 6, asked: 1, kept: 1 }],
      ['a CSV of 300 lines', csvRows, [], { read: 300, ready: 206, asked: 51, kept: 43 }],
    ])('ready, asked and kept add up to the lines read: %s', (_label, lines, accepted, expected) => {
      const summary = summarizeLines(lines, accepted);

      expect(summary).toEqual(expected);
      expect(summary.read).toBe(lines.length);
      expect(summary.ready + summary.asked + summary.kept).toBe(summary.read);
    });

    it.each<[string, string, readonly string[]]>([
      ['25 reads as 20 with one note', '25 Snatch (Red)', ['quantidade acima de 20: lemos 20']],
      ['20 stays 20 with no note', '20 Snatch (Red)', []],
    ])('a quantity of %s', (_label, text, notes) => {
      const [line] = readText(text);

      expect(line).toMatchObject({ outcome: 'ready', cardIdentifier: 'snatch-red', quantity: 20 });
      expect(line!.notes).toEqual(notes);
    });
  });

  it('a quantity word up to twenty is suggested as a number', () => {
    const three = tableRow({ text: 'Savage Beatdown', quantityCell: 'três', colorCell: 'Vermelho' });
    const thirty = tableRow({ text: 'Savage Beatdown', quantityCell: 'trinta', colorCell: 'Vermelho' });

    expect(three).toMatchObject({ outcome: 'bad_quantity', quantity: null, quantityRaw: 'três', suggestedQuantity: 3 });
    expect(thirty).toMatchObject({ outcome: 'bad_quantity', suggestedQuantity: null });
  });

  it('reads the paste of the list screen line by line', () => {
    const lines = readText(...LIST_PHONE_PASTE);

    expect(lines.map((line) => line.outcome)).toEqual([
      'ready',
      'ready',
      'ready',
      'suggestion',
      'asks_color',
      'ready',
      'ready',
      'not_found',
    ]);
    expect(lines[0]).toMatchObject({ cardIdentifier: 'snatch-red', quantity: 3 });
    expect(lines[5]).toMatchObject({ cardIdentifier: 'sink-below-yellow', quantity: 2 });
    expect(lines[2]!.versionNote).toMatch(/^foil · existe em \d+ versões foil: escolha$/);
  });
});

describe('line reader on hostile input', () => {
  const within100ms = (text: string): number => {
    const started = performance.now();
    reader.read({ lineNumber: 1, originalText: text, text });
    return performance.now() - started;
  };

  it('a crafted long line is read within a small time bound', () => {
    const crafted = [
      `1${' '.repeat(20_000)}x`,
      `Snatch${' '.repeat(20_000)}(red`,
      `${'x'.repeat(20_000)} 2x`,
      'a '.repeat(10_000),
      `${'3x '.repeat(5_000)}foil`,
    ];

    const slowest = Math.max(...crafted.map(within100ms));

    expect(slowest).toBeLessThan(100);
  });

  it('a line over the length the reader looks at is kept as not found', () => {
    const [line] = readText(`3x Snatch (Red)${' '.repeat(3_000)}`);
    const [long] = readText(`3x Snatch (Red) ${'x'.repeat(5_000)}`);

    expect(line!.outcome).toBe('ready');
    expect(long!.outcome).toBe('not_found');
    expect(long!.originalText.length).toBeLessThanOrEqual(2_000);
  });
});
