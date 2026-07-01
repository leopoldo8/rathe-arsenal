import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import styles from './about.module.css';

export const Route = createFileRoute('/about')({
  component: AboutPage,
});

/**
 * AboutPage — public fan-content disclaimer page (DISC-03).
 *
 * Falls into `__root.tsx`'s "plain outlet" bucket (neither an
 * AUTH_SHELL_PREFIX nor an AUTH_PAGE_PREFIX) so it renders bare and is
 * reachable without authentication, satisfying the LSS Fan Content Policy
 * requirement that the disclaimer be viewable without an account
 * (docs/research/ip-posture.md). Self-contained: no AppShell/AuthLayout.
 */
export function AboutPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.ornament} aria-hidden="true">
          ◆◆
        </div>
        <h1 className={styles.heading}>{t('about.pageHeading')}</h1>

        <p className={styles.body}>{t('about.fanProjectBody')}</p>

        <p className={styles.disclaimer}>{t('about.disclaimer')}</p>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link to={'/home' as any} className={styles.backLink}>
          {t('about.backLink')}
        </Link>
      </div>
    </div>
  );
}
