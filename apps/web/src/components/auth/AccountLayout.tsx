import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthBrandMark } from '../auth-layout/AuthBrandMark';
import { AuthLayout } from '../auth-layout/AuthLayout';
import { useIsPhone } from './useIsPhone';
import styles from './AccountLayout.module.css';

interface IAccountLayoutProps {
  /** The page's one heading. Visually hidden when the screen's own content opens the page (a shared card, the pitch). */
  readonly title: string;
  readonly hideTitle?: boolean;
  /** The title is the app's own name: on a computer the art panel already says it, so only screen readers get it. */
  readonly titleIsBrand?: boolean;
  readonly children: React.ReactNode;
}

/**
 * The frame of every signed-out account screen (copy rule 6 of `.design/account.md`).
 * On a phone it is one column: the logo, the screen, then the Legend Story Studios notice with "Sobre".
 * From 720 px wide it is the split layout of `AuthLayout`: the art panel on the left, the screen on the right.
 */
export function AccountLayout({ title, hideTitle = false, titleIsBrand = false, children }: IAccountLayoutProps): React.ReactElement {
  const { t } = useTranslation();
  const isPhone = useIsPhone();
  if (!isPhone) {
    return (
      <AuthLayout title={title} hideTitle={hideTitle || titleIsBrand}>
        <div className={styles.onComputer}>{children}</div>
      </AuthLayout>
    );
  }
  return (
    <div className={styles.page}>
      <main className={styles.card}>
        <div className={styles.body}>
          <AuthBrandMark />
          <h1 className={hideTitle ? 'sr-only' : styles.heading}>{title}</h1>
          {children}
        </div>
        <footer className={styles.notice}>
          <p className={styles.noticeText}>{t('about.disclaimer')}</p>
          <Link to="/about" className={styles.noticeLink}>
            {t('about.footerLinkLabel')}
          </Link>
        </footer>
      </main>
    </div>
  );
}
