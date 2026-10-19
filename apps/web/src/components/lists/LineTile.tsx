import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IListLine, TListKind } from '../../api/lists';
import { CardArt } from '../card-art/CardArt';
import { withPitch } from '../deck-detail/recommendations/card-naming';
import { formatBrl } from './listsModel';
import styles from './ListEditor.module.css';

interface ILineTileProps {
  readonly line: IListLine;
  readonly kind: TListKind;
  readonly selected: boolean;
  readonly onSelect: (lineId: number) => void;
}

export function LineTile({ line, kind, selected, onSelect }: ILineTileProps): React.ReactElement {
  const { t } = useTranslation();
  const displayName = withPitch(line.name, line.pitch, (key) => t(key));

  return (
    <li className={styles.tile} data-sold={line.sold || undefined} data-selected={selected || undefined} data-testid="list-line">
      <button
        type="button"
        className={styles.tileButton}
        aria-label={t('lists.editor.openCard', { name: displayName })}
        aria-pressed={selected}
        onClick={() => onSelect(line.id)}
      >
        <span className={styles.art}>
          <CardArt name={line.name} pitch={line.pitch} cost={null} type={line.type} missing={false} size="lg" imageUrl={line.imageUrl} />
          <span className={styles.qty}>{t('lists.editor.quantityBadge', { count: line.quantity })}</span>
          {line.sold && (
            <span className={styles.soldVeil} data-testid="sold-stamp">
              <span>{t('lists.editor.soldStamp')}</span>
            </span>
          )}
        </span>
        <span className={styles.tileName}>
          {line.pitch !== null && <span className={styles.dot} data-pitch={line.pitch} aria-hidden="true" />}
          <span className={styles.tileNameText}>{line.name}</span>
        </span>
      </button>
      {kind === 'sell' && (
        <div className={styles.tileMeta}>
          {line.printingLabel !== null && <span className={styles.chipWide} title={line.printingLabel}>{line.printingLabel}</span>}
          <span className={styles.metaRow}>
            {line.condition !== null ? (
              <span className={styles.chipMono}>{line.condition}</span>
            ) : (
              <span className={styles.blank}>{t('lists.editor.noCondition')}</span>
            )}
            {line.priceCents !== null ? (
              <span className={styles.price}>{formatBrl(line.priceCents)}</span>
            ) : (
              <span className={styles.blank}>{t('lists.editor.noPrice')}</span>
            )}
          </span>
        </div>
      )}
    </li>
  );
}
