import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { writeShareReturn } from '../../lib/share-return';
import styles from './SharedTopBar.module.css';

interface ISharedTopBarProps {
  /** Share token of the page; remembered so sign-in and sign-up come back here. Null on a dead link. */
  readonly shareToken: string | null;
  readonly isSignedIn: boolean;
  /** Route family of the page: `d` (deck, the default) or `l` (list). */
  readonly page?: 'd' | 'l';
  /** False on the pages that draw no "Criar conta" beside "Entrar". */
  readonly offerSignUp?: boolean;
}

/**
 * Slim bar for the public shared pages: the brand, and either the way in
 * (anonymous) or the way back to the app (signed in). The full app shell is
 * not used because these pages must read well without an account.
 */
export function SharedTopBar({ shareToken, isSignedIn, page = 'd', offerSignUp = true }: ISharedTopBarProps): React.ReactElement {
  const { t } = useTranslation();
  const remember = (): void => {
    if (shareToken !== null) writeShareReturn(shareToken, page);
  };

  return (
    <header className={styles.bar}>
      <Link to="/" className={styles.brand} aria-label={t('sharing.page.brandAria')}>
        <img className={styles.seal} src="/favicon.svg" width={32} height={32} alt="" />
        <span className={styles.wordmark}>Rathe Arsenal</span>
      </Link>
      <nav className={styles.actions}>
        {isSignedIn ? (
          <Link to="/home" search={{ tag: [] }} className={styles.ghost}>
            {t('sharing.page.topBarHome')}
          </Link>
        ) : (
          <>
            <Link to="/sign-in" className={styles.ghost} onClick={remember}>
              {t('sharing.page.topBarSignIn')}
            </Link>
            {offerSignUp && (
              <Link to="/sign-up" className={styles.primary} onClick={remember}>
                {t('sharing.page.topBarSignUp')}
              </Link>
            )}
          </>
        )}
      </nav>
    </header>
  );
}
