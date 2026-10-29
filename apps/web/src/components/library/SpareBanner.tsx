import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useSpareQuery } from '../../api/spare';
import styles from './SpareBanner.module.css';

/** "Você tem cópias sobrando · Ver": no number, because the count may still wait for the player's rule. */
export function SpareBanner(): React.ReactElement | null {
  const { t } = useTranslation();
  const query = useSpareQuery();
  const data = query.data;
  if (data === undefined || (!data.needsRule && data.rows.length === 0)) return null;
  return (
    <aside className={styles.banner} aria-label={t('spare.bannerAria')} data-testid="spare-banner">
      <p className={styles.text}>{t('spare.banner')}</p>
      <Link to="/spare" className={styles.link}>
        {t('spare.bannerLink')}
      </Link>
    </aside>
  );
}
