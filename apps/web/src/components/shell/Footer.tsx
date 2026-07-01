import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import styles from './Footer.module.css';

/**
 * Footer — persistent fan-content disclaimer, mounted in AppShell (DISC-01).
 *
 * Satisfies the LSS Fan Content Policy requirement that the disclaimer be
 * visible on every authenticated page (docs/research/ip-posture.md). Renders
 * the localized disclaimer as small, muted body text plus a link to the full
 * /about page.
 */
export function Footer(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <footer className={styles.footer}>
      <p className={styles.disclaimer}>{t('about.disclaimer')}</p>
      {/* /about is registered by T3 in the same phase; the route-tree union
          type is generated at build time so this Link predates that entry.
          Cast follows the existing TopBar.tsx precedent for the same
          route-typing friction. */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Link to={'/about' as any} className={styles.link}>
        {t('about.footerLinkLabel')}
      </Link>
    </footer>
  );
}
