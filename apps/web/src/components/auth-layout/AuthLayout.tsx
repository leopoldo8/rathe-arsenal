import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Deckbox } from '../deckbox/Deckbox';
import { useIsPhone } from '../auth/useIsPhone';
import { AuthBrandMark } from './AuthBrandMark';
import styles from './AuthLayout.module.css';

interface IAuthLayoutProps {
  readonly title: string;
  /** Keeps the one `<h1>` for screen readers only, when the screen's own content opens the page. */
  readonly hideTitle?: boolean;
  readonly subtitle?: string;
  readonly tagline?: string;
  /** Inline error shown as a styled alert below the heading (for invalid credentials etc.) */
  readonly error?: string;
  readonly children: React.ReactNode;
  /** Optional footer content (links) */
  readonly footer?: React.ReactNode;
  /** Mark shown in the left panel; defaults to the cardless brand Deckbox. */
  readonly brandMark?: React.ReactNode;
}

/**
 * AuthLayout — split-panel layout for auth routes.
 *
 * Structure:
 *  - Left panel (>=720px): brand row, brand Deckbox + copy. aria-hidden — decorative.
 *  - Right panel: form area max-width 400px; contains <h1>, optional error alert, children.
 *  - Below 720px: left panel hidden; form stacks full-width.
 *
 * Error states follow the design spec:
 *  - `error` prop renders a styled inline alert (role="alert") using --ra-status-low tone,
 *    replacing the old plain-text `<p style={{ color: 'red' }}>` patterns.
 *
 * DISC-06: a persistent fan-content disclaimer line + /about link renders at
 * the bottom of the layout unconditionally — independent of the optional
 * `footer` prop — so every anon auth route (sign-in, sign-up, etc.) carries
 * the LSS notice per the "every page" requirement in ip-posture.md.
 */
export function AuthLayout({
  title,
  hideTitle = false,
  subtitle,
  tagline,
  error,
  children,
  footer,
  brandMark,
}: IAuthLayoutProps): React.ReactElement {
  const { t } = useTranslation();
  const isNarrow = useIsPhone();

  return (
    <div className={styles.page}>
      <div className={styles.split}>
        {/* Left decoration panel — hidden <720px */}
        {!isNarrow && (
          <div className={styles.art} aria-hidden="true">
            <AuthBrandMark />
            <div className={styles.artContent}>
              <div className={styles.artMark}>
                {brandMark ?? <Deckbox variant="brand" />}
              </div>
              <div className={styles.artTagline}>
                <p className={styles.artTaglineText}>
                  {tagline ?? t('auth.decorationDefaultTagline')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Right form panel */}
        <div className={styles.form}>
          <div className={styles.formInner}>
            <h1 className={hideTitle ? 'sr-only' : styles.heading}>{title}</h1>
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

      {/* DISC-06: persistent disclaimer, independent of the optional footer prop */}
      <div className={styles.disclaimerBar}>
        <p className={styles.disclaimerText}>{t('about.disclaimer')}</p>
        <Link to="/about" className={styles.disclaimerLink}>
          {t('about.footerLinkLabel')}
        </Link>
      </div>
    </div>
  );
}
