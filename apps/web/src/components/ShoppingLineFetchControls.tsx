import { IVariantFetchProgress } from '../api/shopping-line';

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
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button
        type="button"
        onClick={onGetExactPrices}
        disabled={isPending}
        aria-busy={isPending}
        style={{
          padding: '0.375rem 0.75rem',
          backgroundColor: isPending ? '#e2e8f0' : '#3182ce',
          color: isPending ? '#a0aec0' : '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: isPending ? 'not-allowed' : 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 500,
        }}
      >
        {isPending ? 'Starting...' : 'Get exact prices'}
      </button>
      {isError && (
        <span
          role="alert"
          style={{ marginLeft: '0.5rem', fontSize: '0.8125rem', color: '#c53030' }}
        >
          Failed to start. Please try again.
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
  const processed = progress.completed + progress.failed;
  const current = Math.min(processed + 1, progress.total);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        marginTop: '0.5rem',
        fontSize: '0.8125rem',
        color: '#4a5568',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <span>
        Checking card {current} of {progress.total}...
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
  const updated = progress.completed;
  const total = progress.total;

  return (
    <div
      style={{
        marginTop: '0.5rem',
        fontSize: '0.8125rem',
        color: '#744210',
        backgroundColor: '#fefcbf',
        border: '1px solid #f6e05e',
        borderRadius: '4px',
        padding: '0.375rem 0.625rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        flexWrap: 'wrap',
      }}
    >
      <span>
        {updated} of {total} updated &mdash; {progress.failed} failed.
      </span>
      <button
        type="button"
        onClick={onRetry}
        disabled={isPending}
        style={{
          background: 'none',
          border: 'none',
          color: '#c05621',
          cursor: isPending ? 'not-allowed' : 'pointer',
          padding: 0,
          fontSize: '0.8125rem',
          textDecoration: 'underline',
          fontWeight: 500,
        }}
      >
        {isPending ? 'Retrying...' : 'Retry failed'}
      </button>
    </div>
  );
}
