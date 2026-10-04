import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CardScanner.module.css';

interface IScannerBarProps {
  readonly total: number;
  readonly canConfirm: boolean;
  readonly isPending: boolean;
  readonly onReview: () => void;
  readonly onConfirm: () => void;
}

export function ScannerBar({ total, canConfirm, isPending, onReview, onConfirm }: IScannerBarProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.bar}>
      <p className={styles.barCount} data-testid="scanner-bar-count">
        {total === 0 ? t('scanner.barEmpty') : t('scanner.barCount', { count: total })}
      </p>
      <div className={styles.barActions}>
        <button type="button" className={styles.secondaryButton} onClick={onReview} disabled={total === 0}>
          {t('scanner.barReview')}
        </button>
        <button type="button" className={styles.primaryButton} onClick={onConfirm} disabled={!canConfirm}>
          {isPending ? t('scanner.confirmPending') : t('scanner.confirm')}
        </button>
      </div>
    </div>
  );
}
