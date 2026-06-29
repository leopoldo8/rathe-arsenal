import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ReviewsEmptyState.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TEmptyVariant = 'no-subs' | 'all-reviewed' | 'no-results';

interface IReviewsEmptyStateProps {
  readonly variant: TEmptyVariant;
  /** Called when the user clicks the primary CTA link/button. */
  readonly onNavigate?: (() => void) | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ReviewsEmptyState — rendered when the current view has no rows to display.
 *
 * Variants:
 *  - `no-subs`: No substitutions exist across any deck. The user's entire
 *    collection covers all tracked decks as-is.
 *  - `all-reviewed`: No pending substitutions, but approved/rejected exist.
 *    "Caught up" message with a link to the Approved tab.
 *  - `no-results`: Filters are active and returned no matches.
 */
export function ReviewsEmptyState({
  variant,
  onNavigate,
}: IReviewsEmptyStateProps): React.ReactElement {
  const { t } = useTranslation();

  const variantContent: Record<
    TEmptyVariant,
    { readonly heading: string; readonly body: string; readonly cta: string | null }
  > = {
    'no-subs': {
      heading: t('reviews.noSubsHeading'),
      body: t('reviews.noSubsBody'),
      cta: t('reviews.noSubsCta'),
    },
    'all-reviewed': {
      heading: t('reviews.allReviewedHeading'),
      body: t('reviews.allReviewedBody'),
      cta: t('reviews.allReviewedCta'),
    },
    'no-results': {
      heading: t('reviews.noResultsHeading'),
      body: t('reviews.noResultsBody'),
      cta: null,
    },
  };

  const content = variantContent[variant];

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <span className={styles.diamond} aria-hidden="true">
        ◆
      </span>
      <h2 className={styles.heading}>{content.heading}</h2>
      <p className={styles.body}>{content.body}</p>
      {content.cta && onNavigate && (
        <button type="button" className={styles.cta} onClick={onNavigate}>
          {content.cta}
        </button>
      )}
    </div>
  );
}
