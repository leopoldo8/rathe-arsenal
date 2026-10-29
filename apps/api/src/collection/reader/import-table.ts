import * as Papa from 'papaparse';
import { LineReader, MAX_LINE_LENGTH } from './line-reader';
import { IRawLine } from './line-reader.types';

export const MAX_IMPORT_ROWS = 5_000;

export type TColumnName = 'nome' | 'quantidade' | 'cor' | 'versão' | 'estado' | 'set';

/** Headers in Portuguese and English, without accents or case. */
const COLUMN_BY_HEADER: Readonly<Record<string, TColumnName>> = {
  nome: 'nome',
  name: 'nome',
  'card name': 'nome',
  quantidade: 'quantidade',
  quantity: 'quantidade',
  qty: 'quantidade',
  count: 'quantidade',
  cor: 'cor',
  color: 'cor',
  colour: 'cor',
  pitch: 'cor',
  versao: 'versão',
  version: 'versão',
  estado: 'estado',
  condicao: 'estado',
  condition: 'estado',
  set: 'set',
  'set code': 'set',
};

/** A card name has a comma or two; joining more cells than this is never what an unquoted name needs. */
const MAX_NAME_JOINS = 4;

const DELIMITERS: readonly string[] = [',', ';', '\t'];

function plainHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function columnsOf(header: readonly string[]): Map<TColumnName, number> {
  const found = new Map<TColumnName, number>();
  header.forEach((cell, index) => {
    const column = COLUMN_BY_HEADER[plainHeader(cell)];
    if (column !== undefined && !found.has(column)) found.set(column, index);
  });
  return found;
}

function firstLineOf(text: string): string {
  return text.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
}

function detectTable(text: string): { delimiter: string; header: readonly string[]; columns: Map<TColumnName, number> } | null {
  const first = firstLineOf(text);
  for (const delimiter of DELIMITERS) {
    const header = first.split(delimiter);
    const columns = columnsOf(header);
    if (columns.has('nome')) return { delimiter, header, columns };
  }
  return null;
}

export interface IReadImportResult {
  readonly lines: ReturnType<LineReader['read']>[];
  /** The columns the reader used, in the order the file has them. */
  readonly columns: readonly TColumnName[];
}

/** A row with more cells than headers: join cells from the name column until they spell a known card name. */
function mergeNameComma(
  fields: readonly string[],
  headerLength: number,
  nameIndex: number,
  reader: LineReader,
): { fields: readonly string[]; merged: string | null } {
  const extra = Math.min(fields.length - headerLength, MAX_NAME_JOINS);
  for (let join = 1; join <= extra; join += 1) {
    const name = fields.slice(nameIndex, nameIndex + join + 1).join(',');
    if (reader.knowsName(name)) {
      return { fields: [...fields.slice(0, nameIndex), name, ...fields.slice(nameIndex + join + 1)], merged: name.trim() };
    }
  }
  return { fields, merged: null };
}

function readTable(text: string, reader: LineReader, table: NonNullable<ReturnType<typeof detectTable>>): IReadImportResult {
  const parsed = Papa.parse<string[]>(text, { delimiter: table.delimiter, skipEmptyLines: 'greedy' });
  const [, ...rows] = parsed.data;
  const headerLength = table.header.length;
  const nameIndex = table.columns.get('nome')!;
  const cell = (fields: readonly string[], column: TColumnName): string | undefined => {
    const index = table.columns.get(column);
    return index === undefined ? undefined : (fields[index] ?? '').trim();
  };
  const lines = rows.map((original, index) => {
    const { fields, merged } = original.length > headerLength ? mergeNameComma(original, headerLength, nameIndex, reader) : { fields: original, merged: null };
    const raw: IRawLine = {
      lineNumber: index + 2,
      originalText: original.join(table.delimiter).slice(0, MAX_LINE_LENGTH),
      text: (fields[nameIndex] ?? '').trim(),
      isTable: true,
      quantityCell: cell(fields, 'quantidade'),
      colorCell: cell(fields, 'cor'),
      versionCell: cell(fields, 'versão'),
      conditionCell: cell(fields, 'estado'),
      setCell: cell(fields, 'set'),
      notes: merged === null ? [] : [`lemos "${merged}" certo`],
    };
    return reader.read(raw);
  });
  const columns = [...table.columns.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name);
  return { lines, columns };
}

function readFreeText(text: string, reader: LineReader): IReadImportResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line, index) => reader.read({ lineNumber: index + 1, originalText: line.slice(0, MAX_LINE_LENGTH), text: line }));
  return { lines, columns: [] };
}

/**
 * One reader for a paste and for a file: a first line with a name header makes it a table,
 * anything else is read line by line. Counts the data rows so a huge file is refused whole.
 */
export function readImportText(text: string, reader: LineReader): IReadImportResult {
  const table = detectTable(text);
  const result = table === null ? readFreeText(text, reader) : readTable(text, reader, table);
  return result;
}
