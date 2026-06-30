import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button/Button';
import styles from './EducationalEmptyState.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IEducationalEmptyStateProps {
  readonly collectionCardCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * EducationalEmptyState — shown when the user has zero tracked decks.
 *
 * Upgraded copy per origin R22:
 *  - Explains what tracking is.
 *  - Explains what readiness means.
 *  - Shows 3-step explainer.
 *  - Prominent Import CTA.
 *  - "Skip to Library" secondary link (links to `/library`).
 *
 * The CardAutocomplete "add cards manually" affordance is preserved for
 * users who want to build their collection before importing a deck.
 */
export function EducationalEmptyState({
  collectionCardCount,
}: IEducationalEmptyStateProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <section className={styles.container}>
      <div className={styles.intro}>
        <h1 className={styles.heading}>{t('home.welcomeHeading')}</h1>
        <p className={styles.lead}>{t('home.emptyLead')}</p>
        {collectionCardCount > 0 && (
          <p className={styles.collectionHint}>
            {t('home.collectionHintPrefix')}{' '}
            <strong>{collectionCardCount}</strong>{' '}
            {collectionCardCount === 1 ? t('home.collectionHintCard') : t('home.collectionHintCards')}{' '}
            {t('home.collectionHintSuffix')}
          </p>
        )}
      </div>

      <div className={styles.steps} role="list" aria-label={t('home.howItWorksLabel')}>
        <div className={styles.step} role="listitem">
          <div className={styles.stepNumber} aria-hidden="true">01</div>
          <h4 className={styles.stepTitle}>{t('home.step1Title')}</h4>
          <p className={styles.stepBody}>{t('home.step1Body')}</p>
        </div>
        <div className={styles.step} role="listitem">
          <div className={styles.stepNumber} aria-hidden="true">02</div>
          <h4 className={styles.stepTitle}>{t('home.step2Title')}</h4>
          <p className={styles.stepBody}>{t('home.step2Body')}</p>
        </div>
        <div className={styles.step} role="listitem">
          <div className={styles.stepNumber} aria-hidden="true">03</div>
          <h4 className={styles.stepTitle}>{t('home.step3Title')}</h4>
          <p className={styles.stepBody}>{t('home.step3Body')}</p>
        </div>
      </div>

      <div className={styles.cta}>
        <Link to="/decks/new" className={styles.importLink}>
          <Button variant="primary" size="lg">
            {t('home.trackFirstDeckCta')}
          </Button>
        </Link>

        <Link to="/library" className={styles.skipLink}>
          {t('home.skipToLibrary')}
        </Link>
      </div>

      <div className={styles.manualAdd}>
        <p className={styles.manualAddText}>
          {t('home.manualAddPrefix')}{' '}
          <Link to="/library" className={styles.manualAddLink}>
            {t('home.manualAddLinkText')}
          </Link>{' '}
          {t('home.manualAddSuffix')}
        </p>
      </div>
    </section>
  );
}
