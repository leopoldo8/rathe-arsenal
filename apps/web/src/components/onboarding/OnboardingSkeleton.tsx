import React from 'react';
import { StepIndicator } from './StepIndicator';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import styles from './OnboardingSkeleton.module.css';

/**
 * OnboardingSkeleton — content placeholder rendered while the decks query
 * resolves on the onboarding route.
 *
 * Replaces the bare `return null` in `routes/_auth/onboarding.tsx` (R59) so
 * users on slow networks see a meaningful shell rather than a blank flash.
 *
 * Layout mirrors the OnboardingWizard shell:
 *  - StepIndicator at currentStep=1 (the query always starts before step 1)
 *  - Heading + input placeholder for the Step 1 URL field
 *  - Footer with primary + secondary action placeholders
 *
 * A11y: the wrapper carries aria-busy="true" and aria-live="polite" so
 * assistive technology is informed that content is loading and will update.
 * The inner Skeleton primitives each have their own aria-label.
 */
export function OnboardingSkeleton(): React.ReactElement {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading onboarding"
      className={styles.skeleton}
    >
      <div className={styles.indicatorRegion}>
        <StepIndicator totalSteps={3} currentStep={1} />
      </div>

      <div className={styles.body}>
        <div className={styles.headingRow}>
          <Skeleton width="180px" height="14px" aria-label="Loading step label" />
          <Skeleton width="260px" height="28px" aria-label="Loading step heading" />
          <Skeleton width="100%" height="14px" aria-label="Loading step description" />
        </div>

        <Skeleton
          width="100%"
          height="2.625rem"
          aria-label="Loading deck URL input"
        />

        <div className={styles.footer}>
          <Skeleton width="120px" height="2.25rem" aria-label="Loading primary action" />
          <Skeleton width="96px" height="2.25rem" aria-label="Loading secondary action" />
        </div>
      </div>
    </section>
  );
}
