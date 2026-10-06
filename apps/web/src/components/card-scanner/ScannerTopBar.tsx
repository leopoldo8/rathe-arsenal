import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import styles from './CardScanner.module.css';

interface ITorchToggle {
  readonly on: boolean;
  readonly onToggle: () => void;
}

interface IZoomToggle {
  readonly zoom: number;
  readonly onToggle: () => void;
}

interface IScannerTopBarProps {
  readonly torch: ITorchToggle | null;
  readonly zoom: IZoomToggle | null;
}

export function ScannerTopBar({ torch, zoom }: IScannerTopBarProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.topBar}>
      <Link to="/add-cards/manual" className={styles.iconButton} aria-label={t('scanner.close')}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.icon}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </Link>
      <h1 className={styles.topBarTitle}>{t('scanner.title')}</h1>
      <div className={styles.topBarActions}>
        {zoom && (
          <button
            type="button"
            className={styles.iconButton}
            aria-label={t('scanner.zoom', { zoom: formatZoom(zoom.zoom) })}
            onClick={zoom.onToggle}
          >
            <span className={styles.zoomValue}>{formatZoom(zoom.zoom)}×</span>
          </button>
        )}
        {torch ? (
          <button
            type="button"
            className={styles.iconButton}
            aria-pressed={torch.on}
            aria-label={t('scanner.torch')}
            data-active={torch.on ? 'true' : 'false'}
            onClick={torch.onToggle}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.icon}>
              <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
            </svg>
          </button>
        ) : (
          !zoom && <span className={styles.iconSpacer} aria-hidden="true" />
        )}
      </div>
    </div>
  );
}

function formatZoom(zoom: number): string {
  return String(Math.round(zoom * 10) / 10);
}
