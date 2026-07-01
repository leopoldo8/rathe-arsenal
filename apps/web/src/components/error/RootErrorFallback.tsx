import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './RootErrorFallback.module.css';

/**
 * RootErrorFallback — on-brand fallback rendered by AppErrorBoundary when a
 * render error propagates to the app's top-level boundary (OBS-02).
 *
 * Copy goes through t() per AD-001; the two keys live in the existing
 * `shell` namespace alongside `notFound*` — both are full-page fallback
 * states owned by the shell. `role="alert"` gives assistive tech an
 * immediate announcement and doubles as a stable test handle that does not
 * depend on the exact copy rendered inside it.
 *
 * Recovery is a manual page reload (stated in the body copy, no CTA
 * button): this boundary sits above the router, so there is no in-app
 * destination to link back to, and a boundary cannot re-render its own
 * crashed subtree without a full remount.
 */
export function RootErrorFallback(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <section className={styles.container} role="alert">
      <div className={styles.ornament} aria-hidden="true">
        ◆◆
      </div>
      <h1 className={styles.heading}>{t('shell.errorFallbackHeading')}</h1>
      <p className={styles.body}>{t('shell.errorFallbackBody')}</p>
    </section>
  );
}
