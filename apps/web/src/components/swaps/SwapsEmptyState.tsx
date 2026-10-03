import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SwapsEmptyState.module.css';

export type TEmptyVariant =
  | 'no-subs'
  | 'all-reviewed'
  | 'none-approved'
  | 'none-rejected'
  | 'no-results';

interface ISwapsEmptyStateProps {
  readonly variant: TEmptyVariant;
  readonly onNavigate?: (() => void) | undefined;
}

const COPY: Record<
  TEmptyVariant,
  { readonly heading: string; readonly body: string; readonly cta: string | null }
> = {
  'no-subs': { heading: 'swaps.noSubsHeading', body: 'swaps.noSubsBody', cta: 'swaps.noSubsCta' },
  'all-reviewed': {
    heading: 'swaps.allReviewedHeading',
    body: 'swaps.allReviewedBody',
    cta: 'swaps.allReviewedCta',
  },
  'none-approved': {
    heading: 'swaps.noneApprovedHeading',
    body: 'swaps.noneApprovedBody',
    cta: null,
  },
  'none-rejected': {
    heading: 'swaps.noneRejectedHeading',
    body: 'swaps.noneRejectedBody',
    cta: null,
  },
  'no-results': { heading: 'swaps.noResultsHeading', body: 'swaps.noResultsBody', cta: null },
};

export function SwapsEmptyState({
  variant,
  onNavigate,
}: ISwapsEmptyStateProps): React.ReactElement {
  const { t } = useTranslation();
  const copy = COPY[variant];

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <h2 className={styles.heading}>{t(copy.heading)}</h2>
      <p className={styles.body}>{t(copy.body)}</p>
      {copy.cta && onNavigate && (
        <button type="button" className={styles.cta} onClick={onNavigate}>
          {t(copy.cta)}
        </button>
      )}
    </div>
  );
}
