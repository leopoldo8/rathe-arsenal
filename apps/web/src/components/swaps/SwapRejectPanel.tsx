import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SWAP_REJECTION_REASONS } from '../../api/swaps';
import type { TSwapRejectionReason } from '../../api/swaps';
import styles from './SwapRejectPanel.module.css';

export interface IRejectSubmission {
  readonly reason: TSwapRejectionReason | undefined;
  readonly note: string | undefined;
}

interface ISwapRejectPanelProps {
  readonly isBusy: boolean;
  readonly onSubmit: (submission: IRejectSubmission) => void;
  readonly onCancel: () => void;
}

export function SwapRejectPanel({
  isBusy,
  onSubmit,
  onCancel,
}: ISwapRejectPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const titleId = useId();
  const [reason, setReason] = useState<TSwapRejectionReason | undefined>(undefined);
  const [note, setNote] = useState('');

  function handleSubmit(): void {
    const trimmed = note.trim();
    onSubmit({ reason, note: trimmed === '' ? undefined : trimmed });
  }

  return (
    <div className={styles.panel} data-testid="swap-reject-panel">
      <p id={titleId} className={styles.title}>
        {t('swaps.rejectPanelTitle')}
      </p>
      <p className={styles.hint}>{t('swaps.rejectPanelHint')}</p>
      <div className={styles.chips} role="group" aria-label={t('swaps.rejectReasonsAria')}>
        {SWAP_REJECTION_REASONS.map((value) => (
          <button
            key={value}
            type="button"
            className={`${styles.chip} ${reason === value ? styles.chipSelected : ''}`}
            aria-pressed={reason === value}
            onClick={() => setReason(reason === value ? undefined : value)}
          >
            {t(`swaps.rejectionReason.${value}`)}
          </button>
        ))}
      </div>
      <textarea
        className={styles.note}
        value={note}
        placeholder={t('swaps.rejectNoteLabel')}
        aria-label={t('swaps.rejectNoteLabel')}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.confirm}
          disabled={isBusy}
          onClick={handleSubmit}
        >
          {t('swaps.rejectConfirm')}
        </button>
        <button type="button" className={styles.cancel} disabled={isBusy} onClick={onCancel}>
          {t('swaps.rejectCancel')}
        </button>
      </div>
    </div>
  );
}
