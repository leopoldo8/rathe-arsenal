import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import styles from './SharedDeckUnavailable.module.css';

/** 404 SHARE_LINK_UNAVAILABLE: no deck data, and no hint about why the link is dead. */
export function SharedDeckUnavailable(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <section className={styles.section} aria-labelledby="shared-unavailable-title" data-testid="shared-unavailable">
      <p className={styles.eyebrow}>{t('sharing.unavailable.eyebrow')}</p>
      <h1 id="shared-unavailable-title" className={styles.title}>
        {t('sharing.unavailable.title')}
      </h1>
      <p className={styles.body}>{t('sharing.unavailable.body')}</p>
      <div className={styles.actions}>
        <Link to="/sign-up" className={styles.primary}>
          {t('sharing.unavailable.discover')}
        </Link>
        <Link to="/sign-in" className={styles.ghost}>
          {t('sharing.unavailable.signIn')}
        </Link>
      </div>
    </section>
  );
}
