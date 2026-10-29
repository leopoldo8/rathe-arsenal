import type { TFunction } from 'i18next';
import type { ISpareRow } from '../../api/spare';
import type { TFinish } from '../../api/collection-versions';
import { describeVersion } from '../collection-versions/copy-version-labels';
import { finishLabel } from '../collection-versions/copy-version-labels';
import type { ISellLine, TFinishAnswer } from './sellMessage';
import { rowKey, suggestedReais } from './spareModel';

export interface IDraftLine {
  readonly key: string;
  readonly row: ISpareRow;
  readonly quantity: number;
}

/** The rows the player chose, in the order the page showed them, each with its copies. */
export function draftLines(rows: readonly ISpareRow[], chosen: Readonly<Record<string, number>>): readonly IDraftLine[] {
  return rows.flatMap((row) => {
    const quantity = chosen[rowKey(row)] ?? 0;
    return quantity > 0 ? [{ key: rowKey(row), row, quantity }] : [];
  });
}

/** A line with no finish of a card that exists in foil is the one the seller must answer. */
export function needsFinishAnswer(line: IDraftLine): boolean {
  return line.row.finish === '' && line.row.foilFinishes.length > 0;
}

/** The price is a guess while the finish is unknown and could change it. */
export function isApproximate(line: IDraftLine): boolean {
  return needsFinishAnswer(line);
}

export function initialPrices(lines: readonly IDraftLine[]): Record<string, string> {
  return Object.fromEntries(
    lines.map((line) => {
      const reais = suggestedReais(line.row);
      return [line.key, reais === null ? '' : String(reais)] as const;
    }),
  );
}

/** "45", "12,5" and "12.50" are prices in reais; anything else counts as no price. */
export function parseReais(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || !/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}

export function toSellLine(line: IDraftLine, priceText: string, answer: TFinishAnswer | null): ISellLine {
  return {
    quantity: line.quantity,
    name: line.row.name,
    pitch: line.row.pitch,
    priceReais: parseReais(priceText),
    setName: line.row.setName,
    printingCode: line.row.printingCode,
    edition: line.row.edition,
    finish: line.row.finish,
    condition: line.row.condition,
    foilFinishes: line.row.foilFinishes,
    answer,
  };
}

/** What the sell list stores as the line's finish: its own, or the one the seller's answer settles. */
export function storedFinish(line: IDraftLine, answer: TFinishAnswer | null): string {
  if (line.row.finish !== '') return line.row.finish;
  if (answer === 'none') return 'none';
  const [onlyFoil] = line.row.foilFinishes;
  if (answer === 'foil' && line.row.foilFinishes.length === 1 && onlyFoil !== undefined) return onlyFoil;
  return '';
}

/** The line's second row on the seller's screen: its version, what the seller answered, and whether the price is a guess. */
export function lineSubtitle(line: IDraftLine, answer: TFinishAnswer | null, t: TFunction): string {
  const known = describeVersion(line.row, t, () => line.row.setName);
  const answered = line.row.finish === '' && answer === 'none' ? [t('spare.messageNoFoil')] : [];
  const foil =
    line.row.finish === '' && answer === 'foil'
      ? [line.row.foilFinishes.length === 1 && line.row.foilFinishes[0] !== undefined ? finishLabel(line.row.foilFinishes[0] as TFinish, t) : t('spare.messageFoil')]
      : [];
  const parts = [...(known === '' ? [] : [known]), ...answered, ...foil];
  return [...(parts.length === 0 ? [t('spare.lineVersionUnknown')] : parts), ...(isApproximate(line) ? [t('spare.lineApproximate')] : [])].join(' · ');
}
