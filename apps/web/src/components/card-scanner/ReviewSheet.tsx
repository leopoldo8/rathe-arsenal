import React from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { MAX_ROW_QUANTITY, MIN_ROW_QUANTITY, type IScanSession, type ITrayRow } from './scan-session';
import { localizeApiError } from './localize-api-error';
import { CardName, CardThumb } from './CardFace';
import styles from './CardScanner.module.css';

interface IReviewSheetProps {
  readonly open: boolean;
  readonly session: IScanSession;
  readonly canConfirm: boolean;
  readonly isPending: boolean;
  readonly error: unknown;
  readonly onClose: () => void;
  readonly onQuantity: (rowKey: string, quantity: number) => void;
  readonly onRemove: (rowKey: string) => void;
  readonly onPick: (rowKey: string, cardIdentifier: string) => void;
  readonly onConfirm: () => void;
}

export function ReviewSheet(props: IReviewSheetProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.sheet} aria-describedby={undefined}>
          <div className={styles.sheetHeader}>
            <Dialog.Title className={styles.sheetTitle}>{t('scanner.reviewTitle')}</Dialog.Title>
            <Dialog.Close className={styles.secondaryButton}>{t('scanner.reviewClose')}</Dialog.Close>
          </div>
          <ul className={styles.reviewList}>
            {props.session.rows.map((row) => (
              <ReviewRow key={row.key} row={row} {...props} />
            ))}
          </ul>
          {props.error !== null && props.error !== undefined && (
            <div className={styles.reviewError} role="alert">
              <p>{localizeApiError(props.error, t)}</p>
              <button type="button" className={styles.secondaryButton} onClick={props.onConfirm} disabled={!props.canConfirm}>
                {t('scanner.retry')}
              </button>
            </div>
          )}
          <button type="button" className={styles.primaryButton} onClick={props.onConfirm} disabled={!props.canConfirm}>
            {props.isPending ? t('scanner.confirmPending') : t('scanner.confirm')}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ReviewRow({
  row,
  onQuantity,
  onRemove,
  onPick,
}: IReviewSheetProps & { readonly row: ITrayRow }): React.ReactElement {
  const { t } = useTranslation();
  const name = row.picked?.name ?? row.candidates.map((card) => card.name).join(' / ');

  return (
    <li className={styles.reviewRow} data-testid="review-row">
      {row.picked ? (
        <div className={styles.reviewCard}>
          <CardThumb card={row.picked} />
          <CardName card={row.picked} />
        </div>
      ) : (
        <fieldset className={styles.facePicker}>
          <legend className={styles.facePickerLegend}>{t('scanner.reviewPickFace')}</legend>
          {row.candidates.map((card) => (
            <button
              key={card.cardIdentifier}
              type="button"
              className={styles.faceOption}
              onClick={() => onPick(row.key, card.cardIdentifier)}
            >
              <CardThumb card={card} />
              <CardName card={card} />
            </button>
          ))}
        </fieldset>
      )}
      <div className={styles.reviewActions}>
        <div className={styles.stepper} role="group">
          <button
            type="button"
            className={styles.stepButton}
            onClick={() => onQuantity(row.key, row.quantity - 1)}
            disabled={row.quantity <= MIN_ROW_QUANTITY}
            aria-label={t('scanner.reviewDecrease', { name })}
          >
            −
          </button>
          <span className={styles.stepValue} aria-live="polite">
            {row.quantity}
          </span>
          <button
            type="button"
            className={styles.stepButton}
            onClick={() => onQuantity(row.key, row.quantity + 1)}
            disabled={row.quantity >= MAX_ROW_QUANTITY}
            aria-label={t('scanner.reviewIncrease', { name })}
          >
            +
          </button>
        </div>
        <button
          type="button"
          className={styles.removeButton}
          onClick={() => onRemove(row.key)}
          aria-label={t('scanner.reviewRemove', { name })}
        >
          ×
        </button>
      </div>
    </li>
  );
}
