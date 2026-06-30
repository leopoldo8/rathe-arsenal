import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeckboxDecoration } from '../shell/DeckboxDecoration';
import styles from './AuthLayout.module.css';

interface IAuthLayoutProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly tagline?: string;
  /** Inline error shown as a styled alert below the heading (for invalid credentials etc.) */
  readonly error?: string;
  readonly children: React.ReactNode;
  /** Optional footer content (links) */
  readonly footer?: React.ReactNode;
}

const NARROW_QUERY = '(max-width: 719px)';

/**
 * AuthLayout — split-panel layout for auth routes.
 *
 * Structure:
 *  - Left panel (>=720px): deckbox SVG decoration + brand copy. aria-hidden — decorative.
 *  - Right panel: form area max-width 420px; contains <h1>, optional error alert, children.
 *  - Below 720px: left panel hidden; form stacks full-width.
 *
 * Error states follow the design spec:
 *  - `error` prop renders a styled inline alert (role="alert") using --ra-status-low tone,
 *    replacing the old plain-text `<p style={{ color: 'red' }}>` patterns.
 */
export function AuthLayout({
  title,
  subtitle,
  tagline,
  error,
  children,
  footer,
}: IAuthLayoutProps): React.ReactElement {
  const { t } = useTranslation();
  const [isNarrow, setIsNarrow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(NARROW_QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(NARROW_QUERY);
    const handler = (e: MediaQueryListEvent): void => setIsNarrow(e.matches);
    mql.addEventListener('change', handler);
    setIsNarrow(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return (
    <div className={styles.split}>
      {/* Left decoration panel — hidden <720px */}
      {!isNarrow && (
        <div className={styles.art} aria-hidden="true">
          <div className={styles.artContent}>
            <div className={styles.artMark}>
              <DeckboxDecoration />
            </div>
            <div className={styles.artTagline}>
              <p className={styles.artTaglineText}>
                {tagline ?? t('auth.decorationDefaultTagline')}
              </p>
              <p className={styles.artCopy}>
                {t('auth.decorationCopy')}
              </p>
            </div>
          </div>
          <blockquote className={styles.artQuote}>
            &ldquo;{t('auth.decorationQuote')}&rdquo;
            <cite className={styles.artCite}>{t('auth.decorationQuoteCite')}</cite>
          </blockquote>
        </div>
      )}

      {/* Right form panel */}
      <div className={styles.form}>
        <div className={styles.formInner}>
          <h1 className={styles.heading}>{title}</h1>
          {subtitle != null && <p className={styles.sub}>{subtitle}</p>}

          {error != null && error !== '' && (
            <div role="alert" className={styles.errorAlert}>
              {error}
            </div>
          )}

          {children}

          {footer != null && (
            <div className={styles.footer}>{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}
