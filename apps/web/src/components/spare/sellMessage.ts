import type { TFunction } from 'i18next';
import { cardName } from '../../lib/card-name';
import { editionLabel, finishLabel } from '../collection-versions/copy-version-labels';
import type { TEdition, TFinish } from '../../api/collection-versions';
import { plural } from './spareModel';

/** The longest sell message the group chat gets in lines; the rest is "e mais N cartas no link". */
export const MESSAGE_MAX_LINES = 30;

/** What the seller answered when asked about a line whose finish is unknown. */
export type TFinishAnswer = 'none' | 'foil' | 'unknown';

export interface ISellLine {
  readonly quantity: number;
  readonly name: string;
  readonly pitch: 1 | 2 | 3 | null;
  /** The price of one copy in reais, whole or with cents; null when the seller left it empty. */
  readonly priceReais: number | null;
  readonly setName: string | null;
  readonly printingCode: string;
  readonly edition: string;
  readonly finish: string;
  readonly condition: string;
  /** The foil finishes this line could be; empty when its card (or printing) has none. */
  readonly foilFinishes: readonly string[];
  readonly answer: TFinishAnswer | null;
}

/** "R$ 45" for whole reais, "R$ 12,50" otherwise: the message is the seller's own text, not a price column. */
export function formatReais(reais: number): string {
  return Number.isInteger(reais) ? `${reais}` : reais.toFixed(2).replace('.', ',');
}

/** The word for the line's finish: its own, the seller's answer, or the honest "foil não conferido". */
export function finishWords(line: ISellLine, t: TFunction): string | null {
  if (line.finish === 'none') return t('spare.messageNoFoil');
  if (line.finish !== '') return finishLabel(line.finish as TFinish, t);
  const [onlyFoil] = line.foilFinishes;
  if (line.foilFinishes.length === 0) return null;
  if (line.answer === 'none') return t('spare.messageNoFoil');
  if (line.answer === 'foil') return line.foilFinishes.length === 1 && onlyFoil !== undefined ? finishLabel(onlyFoil as TFinish, t) : t('spare.messageFoil');
  return t('spare.messageFoilUnchecked');
}

function lineText(line: ISellLine, t: TFunction): string {
  const head = t('spare.messageLine', { count: line.quantity, name: cardName(line.name, line.pitch, (key) => t(key)) });
  const parts = [
    line.setName ?? line.printingCode,
    line.edition === '' ? '' : editionLabel(line.edition as TEdition, t),
    finishWords(line, t) ?? '',
    line.condition,
    line.priceReais === null
      ? ''
      : t(line.quantity > 1 ? 'spare.messageEach' : 'spare.messagePrice', { price: formatReais(line.priceReais) }),
  ].filter((part) => part !== '');
  return [head, ...parts].join(' · ');
}

export interface ISellMessageInput {
  readonly lines: readonly ISellLine[];
  readonly includeTotal: boolean;
  readonly closingLine: string;
  readonly link: string;
}

/** "VENDO", one line per sell line, the total, the seller's closing line and the link. */
export function buildSellMessage({ lines, includeTotal, closingLine, link }: ISellMessageInput, t: TFunction): string {
  const shown = lines.slice(0, MESSAGE_MAX_LINES).map((line) => lineText(line, t));
  const hiddenCopies = lines.slice(MESSAGE_MAX_LINES).reduce((sum, line) => sum + line.quantity, 0);
  const copies = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.quantity * (line.priceReais ?? 0), 0);
  return [
    t('spare.messageHeading'),
    ...shown,
    ...(hiddenCopies > 0 ? [plural(t, 'spare.messageMore', hiddenCopies)] : []),
    ...(includeTotal ? [plural(t, 'spare.messageTotal', copies, { price: formatReais(total) })] : []),
    '',
    ...(closingLine.trim() === '' ? [] : [closingLine.trim()]),
    link,
  ].join('\n');
}
