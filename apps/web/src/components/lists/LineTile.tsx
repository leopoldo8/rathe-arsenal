import React from 'react';
import { useTranslation } from 'react-i18next';
import { useApplySuggestionsMutation, type IListLine, type TListKind } from '../../api/lists';
import { CardArt } from '../card-art/CardArt';
import { withPitch } from '../deck-detail/recommendations/card-naming';
import { formatBrl } from './listsModel';
import styles from './ListEditor.module.css';

interface ILineTileProps {
  readonly listId: number;
  readonly line: IListLine;
  readonly kind: TListKind;
  readonly selected: boolean;
  readonly onSelect: (lineId: number) => void;
}

export function LineTile({ listId, line, kind, selected, onSelect }: ILineTileProps): React.ReactElement {
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
            <LinePrice listId={listId} line={line} name={displayName} />
          </span>
          {!line.sold && <TcgplayerNote listId={listId} line={line} name={displayName} />}
        </div>
      )}
    </li>
  );
}

interface ILinePriceProps {
  readonly listId: number;
  readonly line: IListLine;
  readonly name: string;
}

function LinePrice({ listId, line, name }: ILinePriceProps): React.ReactElement {
  const { t } = useTranslation();
  const apply = useApplySuggestionsMutation(listId);
  if (line.priceCents !== null) return <span className={styles.price}>{formatBrl(line.priceCents)}</span>;
  if (line.sold || line.suggestion === null) return <span className={styles.blank}>{t('lists.editor.noPrice')}</span>;
  const price = formatBrl(line.suggestion.cents);
  return (
    <button
      type="button"
      className={styles.suggested}
      aria-label={t('lists.pricing.useSuggestedFor', { price, name })}
      disabled={apply.isPending}
      onClick={() => apply.mutate([line.id])}
    >
      <span aria-hidden="true">+</span>
      <span className={styles.suggestedPrice}>{price}</span>
      {t('lists.pricing.suggested')}
    </button>
  );
}

function TcgplayerNote({ listId, line, name }: ILinePriceProps): React.ReactElement | null {
  const { t } = useTranslation();
  const apply = useApplySuggestionsMutation(listId);
  if (line.suggestion === null) {
    return line.priceCents === null ? <span className={styles.tcgNone}>{t('lists.pricing.noTcgPrice')}</span> : null;
  }
  if (line.priceCents === null || line.priceCents === line.suggestion.cents) return null;
  const price = formatBrl(line.suggestion.cents);
  return (
    <span className={styles.tcgRow}>
      <span className={styles.tcgLabel}>{t('lists.pricing.tcgPrice', { price })}</span>
      <button
        type="button"
        className={styles.tcgUse}
        aria-label={t('lists.pricing.useTcgFor', { price, name })}
        disabled={apply.isPending}
        onClick={() => apply.mutate([line.id])}
      >
        {t('lists.pricing.use')}
      </button>
    </span>
  );
}
