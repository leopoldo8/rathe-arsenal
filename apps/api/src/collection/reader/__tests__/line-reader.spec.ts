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

  it('every line is counted once and quantities cap at 20', () => {
    const lines = readText(...LIST_PHONE_PASTE);
    const manyLines = readText(...Array.from({ length: 300 }, (_unused, index) => (index % 7 === 0 ? 'Cartaqualquer' : index % 5 === 0 ? '2 Pummel' : '1 Snatch (Red)')));
    const [capped, exact] = readText('25 Snatch (Red)', '20 Snatch (Red)');

    expect(summarizeLines(lines, [4])).toEqual({ read: 8, ready: 6, asked: 1, kept: 1 });
    const many = summarizeLines(manyLines);
    expect(many.ready + many.asked + many.kept).toBe(300);
    expect(capped).toMatchObject({ quantity: 20 });
    expect(capped!.notes).toHaveLength(1);
    expect(exact).toMatchObject({ quantity: 20 });
    expect(exact!.notes).toEqual([]);
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
