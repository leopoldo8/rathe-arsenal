import React from 'react';
import { useContext } from 'react';
import { AuthContext } from '../../auth/AuthContext';
import { Button } from '../ui/Button/Button';
import styles from './NotFoundState.module.css';

/**
 * NotFoundState — brand-voiced 404 surface for any unmatched route.
 *
 * Heading: "Off the map."
 * Body: "This page isn't part of your arsenal."
 * CTA: "Back to home" — routes to /_auth/home when authenticated,
 *       /sign-in when not.
 *
 * Ornament style mirrors EducationalEmptyState: Cinzel display numerals
 * repurposed as a visual anchor (the double-diamond "◆◆" glyph from the
 * brand voice system).
 *
 * Wired as the notFoundComponent in __root.tsx so it mounts inside the
 * appropriate shell (AppShell for authenticated routes, plain for anon).
 */
export function NotFoundState(): React.ReactElement {
  const authCtx = useContext(AuthContext);
  const isAuthenticated = authCtx?.user != null;
  const homeHref = isAuthenticated ? '/home' : '/sign-in';
  const ctaLabel = isAuthenticated ? 'Back to home' : 'Sign in';

  return (
    <section className={styles.container}>
      <div className={styles.ornament} aria-hidden="true">
        ◆◆
      </div>
      <h1 className={styles.heading}>Off the map.</h1>
      <p className={styles.body}>This page isn&apos;t part of your arsenal.</p>
      <a href={homeHref} className={styles.ctaLink}>
        <Button variant="primary" size="md">
          {ctaLabel}
        </Button>
      </a>
    </section>
  );
}
