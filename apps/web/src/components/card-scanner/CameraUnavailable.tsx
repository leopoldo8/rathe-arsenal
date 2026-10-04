import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import styles from './CardScanner.module.css';

export function CameraUnavailable({ failure }: { readonly failure: 'denied' | 'no-camera' }): React.ReactElement {
  const { t } = useTranslation();
  const prefix = failure === 'denied' ? 'permissionDenied' : 'noCamera';
  return (
    <div className={styles.unavailable} role="alert" data-state={failure}>
      <h2 className={styles.unavailableTitle}>{t(`scanner.${prefix}Title`)}</h2>
      <p>{t(`scanner.${prefix}Body`)}</p>
      <Link to="/add-cards/manual" className={styles.primaryButton}>
        {t('scanner.goManual')}
      </Link>
    </div>
  );
}
