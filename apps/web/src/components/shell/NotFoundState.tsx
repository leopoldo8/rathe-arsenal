import React from 'react';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../auth/AuthContext';
import { Button } from '../ui/Button/Button';
import styles from './NotFoundState.module.css';

/**
 * NotFoundState — brand-voiced 404 surface for any unmatched route.
 *
 * Heading: "Fora do mapa." / "Off the map."
 * Body: "Esta página não faz parte do seu arsenal." / "This page isn't part of your arsenal."
 * CTA: "Voltar ao início" / "Back to home" — routes to /_auth/home when authenticated,
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
  const { t } = useTranslation();
  const authCtx = useContext(AuthContext);
  const isAuthenticated = authCtx?.user != null;
  const homeHref = isAuthenticated ? '/home' : '/sign-in';
  const ctaLabel = isAuthenticated ? t('shell.notFoundCtaAuthenticated') : t('shell.notFoundCtaAnon');

  return (
    <section className={styles.container}>
      <div className={styles.ornament} aria-hidden="true">
        ◆◆
      </div>
      <h1 className={styles.heading}>{t('shell.notFoundHeading')}</h1>
      <p className={styles.body}>{t('shell.notFoundBody')}</p>
      <a href={homeHref} className={styles.ctaLink}>
        <Button variant="primary" size="md">
          {ctaLabel}
        </Button>
      </a>
    </section>
  );
}
