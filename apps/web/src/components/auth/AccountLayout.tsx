import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { AuthBrandMark } from '../auth-layout/AuthBrandMark';
import styles from './AccountLayout.module.css';

interface IAccountLayoutProps {
  /** The page's one heading. Visually hidden when the screen's own content opens the page (a shared card, the pitch). */
  readonly title: string;
  readonly hideTitle?: boolean;
  readonly children: React.ReactNode;
}

/**
 * One column for every signed-out account screen, on a phone as on a computer: the logo, the screen,
 * then the Legend Story Studios notice with "Sobre" (copy rule 6 of `.design/account.md`).
 */
export function AccountLayout({ title, hideTitle = false, children }: IAccountLayoutProps): React.ReactElement {
  const { t } = useTranslation();
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
