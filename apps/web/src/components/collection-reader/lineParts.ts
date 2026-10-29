import { cardName } from '../../lib/card-name';
import { cardOf, groupOf, isReady, type IReaderItem } from './readerState';
import styles from './CollectionReader.module.css';

/** The title of a line once its card is known: "3 Snatch (Vermelho)". */
export function readyTitle(item: IReaderItem, t: (key: string) => string): string {
  const card = cardOf(item);
  return card === null ? item.line.originalText : `${item.quantity ?? ''} ${cardName(card.name, card.pitch, t)}`.trim();
}

export function lineMark(item: IReaderItem): { readonly className: string; readonly glyph: string; readonly labelKey: string } {
  if (isReady(item)) return { className: styles.markReady!, glyph: '✓', labelKey: 'collectionReader.markReady' };
  if (groupOf(item) === 'notFound') return { className: styles.markNotFound!, glyph: '×', labelKey: 'collectionReader.markNotFound' };
  return { className: styles.markAsks!, glyph: '!', labelKey: 'collectionReader.markAsks' };
}
