import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import styles from './CardScanner.module.css';

interface IScannerTopBarProps {
  readonly torchAvailable: boolean;
  readonly torchOn: boolean;
  readonly onTorchToggle: () => void;
}

export function ScannerTopBar({ torchAvailable, torchOn, onTorchToggle }: IScannerTopBarProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.topBar}>
      <Link to="/add-cards/manual" className={styles.iconButton} aria-label={t('scanner.close')}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.icon}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <h1 className={styles.topBarTitle}>{t('scanner.title')}</h1>
      {torchAvailable ? (
        <button
          type="button"
          className={styles.iconButton}
          aria-pressed={torchOn}
          aria-label={t('scanner.torch')}
          data-active={torchOn ? 'true' : 'false'}
          onClick={onTorchToggle}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.icon}>
            <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
          </svg>
        </button>
      ) : (
        <span className={styles.iconSpacer} aria-hidden="true" />
      )}
    </div>
  );
}
