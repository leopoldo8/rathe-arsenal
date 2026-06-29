import { useTranslation } from 'react-i18next';
import { IVariantFetchProgress } from '../api/shopping-line';
import styles from './ShoppingLineFetchControls.module.css';

/**
 * Variant fetch UI controls extracted from ShoppingLine.tsx.
 *
 * Kept in a sibling file so ShoppingLine.tsx stays under the 800-line
 * guideline. These components are purely presentational and receive all
 * state through props from the parent shopping line section.
 */

// -------------------------------------------------------------------------
// Variant fetch CTA button
// -------------------------------------------------------------------------

interface IVariantFetchCtaProps {
  readonly onGetExactPrices: () => void;
  readonly isPending: boolean;
  readonly isError: boolean;
}

export function VariantFetchCta({
  onGetExactPrices,
  isPending,
  isError,
}: IVariantFetchCtaProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.ctaWrapper}>
      <button
        type="button"
        onClick={onGetExactPrices}
        disabled={isPending}
        aria-busy={isPending}
        data-pending={String(isPending)}
        className={styles.ctaBtn}
      >
        {isPending ? t('decks.startingBtn') : t('decks.getExactPrices')}
      </button>
      {isError && (
        <span
          role="alert"
          className={styles.ctaError}
        >
          {t('decks.failedToStart')}
        </span>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Progress indicator (shown while fetch is active)
// -------------------------------------------------------------------------

interface IVariantFetchProgressProps {
  readonly progress: IVariantFetchProgress;
}

export function VariantFetchProgress({ progress }: IVariantFetchProgressProps) {
  const { t } = useTranslation();
  const processed = progress.completed + progress.failed;
  const current = Math.min(processed + 1, progress.total);

  return (
    <div
      role="status"
      aria-live="polite"
      className={styles.progress}
    >
      <span>
        {t('decks.checkingCard', { current, total: progress.total })}
      </span>
    </div>
  );
}

// -------------------------------------------------------------------------
// Partial failure notice (shown after fetch completes with failures)
// -------------------------------------------------------------------------

interface IPartialFailureNoticeProps {
  readonly progress: IVariantFetchProgress;
  readonly onRetry: () => void;
  readonly isPending: boolean;
}

export function PartialFailureNotice({
  progress,
  onRetry,
  isPending,
}: IPartialFailureNoticeProps) {
  const { t } = useTranslation();
  const updated = progress.completed;
  const total = progress.total;

  return (
    <div className={styles.failureNotice}>
      <span>
        {t('decks.partialUpdateMsg', { updated, total, failed: progress.failed })}
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={isPending}
        data-pending={String(isPending)}
        className={styles.failureRetryBtn}
      >
        {isPending ? t('decks.retryingBtn') : t('decks.retryFailedBtn')}
      </button>
    </div>
  );
}
