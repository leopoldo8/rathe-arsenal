import { useState, useEffect } from 'react';
import {
  IShoppingLinePopulated,
  IShoppingLineResponse,
  IShoppingLineLine,
  IShoppingLineVariant,
  IVariantFetchProgress,
} from '../api/shopping-line';
import { VARIANT_FETCH_POLL_TIMEOUT_MS } from '../api/deck-detail';
import { formatBrl } from '../utils/format-brl';
import { formatRelativeTime, isStale, isVeryStale } from '../utils/format-relative-time';
import { StoreProductLink } from './StoreProductLink';

/**
 * Status of the variant fetch mutation, passed from the parent component
 * which owns the `useVariantFetchMutation` hook.
 */
export type TVariantFetchMutationStatus = 'idle' | 'pending' | 'success' | 'error';

interface IShoppingLineProps {
  /**
   * Shopping line data from the API response.
   *
   *  null                      = Path A (no missing cards)
   *  { kind: 'unscraped' }     = store not yet scraped; hide entirely
   *  { kind: 'error', ... }    = computation failed; show degraded state
   *  { kind: 'populated', ... } = real stock data
   */
  readonly data: IShoppingLineResponse | null;
  /**
   * Called when the user clicks "Get exact prices" or "Retry failed".
   * The parent owns the mutation hook and passes this callback down.
   * When absent, the CTA is not rendered.
   */
  readonly onFetchVariants?: () => void;
  /**
   * Current status of the variant fetch mutation. Controls CTA state.
   * Defaults to 'idle'.
   */
  readonly fetchMutationStatus?: TVariantFetchMutationStatus;
  /**
   * True when the last mutation resulted in 'already_fresh'. When true,
   * the CTA is replaced with an "up to date" message.
   */
  readonly isCooldownActive?: boolean;
  /**
   * Callback invoked when the component transitions in or out of the
   * active polling state. Called with epoch-ms when polling begins, or
   * `undefined` when polling stops.
   */
  readonly onPollingChange?: (startedAt: number | undefined) => void;
}

/**
 * Shopping Line section.
 *
 * Renders the per-deck availability summary sourced from Cupula DT's
 * store stock. Handles 6 distinct UI states (D9):
 *  1. null (Path A) -- success empty state
 *  2. kind='unscraped' -- hide entirely (keep Phase 1a behaviour)
 *  3. kind='error' -- degraded state with retry link
 *  4. kind='populated', availableCardCount === 0 -- no stock state
 *  5. kind='populated', partial -- two sub-groups (in stock / unavailable)
 *  6. kind='populated', fully available -- all-stock variant
 *
 * Variant-aware additions (Unit 6):
 *  - Estimated badge on headline when isEstimated === true
 *  - "Get exact prices" CTA when isEstimated === true and cards are missing
 *  - Progress indicator while variantFetchProgress.inProgress === true
 *  - Polling lifecycle managed via onPollingChange callback to parent
 *
 * The headline affordance is wrapped in aria-live="polite" so screen
 * readers announce updates after substitute rejection (D10).
 */
export function ShoppingLine({
  data,
  onFetchVariants,
  fetchMutationStatus = 'idle',
  isCooldownActive = false,
  onPollingChange,
}: IShoppingLineProps) {
  // State 1: null = Path A, nothing missing
  if (data === null) {
    return <PathAEmptyState />;
  }

  // State 2: unscraped -- hide entirely until first real scrape
  if (data.kind === 'unscraped') {
    return null;
  }

  // State 3: server-side error
  if (data.kind === 'error') {
    return <ErrorState />;
  }

  // States 4, 5, 6: populated
  return (
    <PopulatedShoppingLine
      data={data}
      {...(onFetchVariants !== undefined ? { onFetchVariants } : {})}
      fetchMutationStatus={fetchMutationStatus}
      isCooldownActive={isCooldownActive}
      {...(onPollingChange !== undefined ? { onPollingChange } : {})}
    />
  );
}

// ---------------------------------------------------------------------------
// Empty state (Path A)
// ---------------------------------------------------------------------------

function PathAEmptyState() {
  return (
    <div
      role="status"
      style={{
        padding: '0.875rem 1rem',
        backgroundColor: '#f0fff4',
        border: '1px solid #9ae6b4',
        borderRadius: '6px',
        color: '#22543d',
        fontSize: '0.875rem',
      }}
    >
      You have everything you need for this deck.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState() {
  return (
    <div
      role="status"
      style={{
        padding: '0.875rem 1rem',
        backgroundColor: '#fff5f5',
        border: '1px solid #feb2b2',
        borderRadius: '6px',
        color: '#742a2a',
        fontSize: '0.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      <span>Shopping line temporarily unavailable.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          background: 'none',
          border: 'none',
          color: '#3182ce',
          cursor: 'pointer',
          padding: 0,
          fontSize: '0.875rem',
          textDecoration: 'underline',
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Populated state
// ---------------------------------------------------------------------------

interface IPopulatedProps {
  readonly data: IShoppingLinePopulated;
  readonly onFetchVariants?: () => void;
  readonly fetchMutationStatus: TVariantFetchMutationStatus;
  readonly isCooldownActive: boolean;
  readonly onPollingChange?: (startedAt: number | undefined) => void;
}

function PopulatedShoppingLine({
  data,
  onFetchVariants,
  fetchMutationStatus,
  isCooldownActive,
  onPollingChange,
}: IPopulatedProps) {
  const {
    storeName,
    storeHostname,
    totalCostCents,
    availableCardCount,
    unavailableCardCount,
    lines,
    lastFetchedAt,
    isEstimated,
    variantFetchProgress,
  } = data;

  const totalMissing = availableCardCount + unavailableCardCount;
  const relativeTime = formatRelativeTime(lastFetchedAt);
  const stale = isStale(lastFetchedAt);
  const veryStale = isVeryStale(lastFetchedAt);

  const freshnessColor = veryStale ? '#c53030' : stale ? '#b7791f' : '#718096';

  const availableLines = lines.filter((l) => l.quantityAvailable > 0);
  const unavailableLines = lines.filter((l) => l.quantityAvailable === 0);

  // Track whether the 5-minute polling timeout has fired.
  const [pollingTimedOut, setPollingTimedOut] = useState(false);

  // Determine if we are in an active polling state.
  // Stop polling when: progress is absent (pod restart), inProgress is false,
  // or the local 5-minute safety timeout has fired.
  const isFetching = Boolean(
    variantFetchProgress?.inProgress && !pollingTimedOut,
  );

  // Notify parent when polling starts or stops.
  useEffect(() => {
    if (!onPollingChange) return;
    if (isFetching) {
      onPollingChange(Date.now());
    } else {
      onPollingChange(undefined);
    }
  }, [isFetching, onPollingChange]);

  // 5-minute hard safety timeout: stop polling even if backend never signals done.
  useEffect(() => {
    if (!isFetching) {
      setPollingTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      setPollingTimedOut(true);
    }, VARIANT_FETCH_POLL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isFetching]);

  const isPending = fetchMutationStatus === 'pending';
  const isMutationError = fetchMutationStatus === 'error';

  const canShowCta = onFetchVariants !== undefined;
  const showCta = Boolean(isEstimated) && !isFetching && totalMissing > 0 && canShowCta;
  const showProgress = isFetching && variantFetchProgress !== undefined;
  const showRetryFailed = Boolean(
    variantFetchProgress &&
      !variantFetchProgress.inProgress &&
      variantFetchProgress.failed > 0,
  ) && canShowCta;

  return (
    <section
      aria-label="Shopping line"
      style={{
        border: '1px solid #e2e8f0',
        borderRadius: '6px',
        overflow: 'hidden',
      }}
    >
      {/* Section header */}
      <header
        style={{
          padding: '0.625rem 1rem',
          backgroundColor: '#f7fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#2d3748',
            letterSpacing: '0.01em',
          }}
        >
          Shopping line &middot; {storeName}
        </h2>
        <span
          style={{
            fontSize: '0.75rem',
            color: freshnessColor,
          }}
          title={lastFetchedAt}
        >
          updated {relativeTime}
          {veryStale && ' (prices may have changed)'}
        </span>
      </header>

      {/* Headline affordance */}
      <div
        style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #e2e8f0' }}
      >
        <div aria-live="polite">
          {availableCardCount > 0 ? (
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                color: '#2d3748',
                fontSize: '0.9375rem',
              }}
            >
              With{' '}
              {isEstimated && (
                <span
                  aria-label="estimated price"
                  title="Price is estimated from listing data. Click 'Get exact prices' for accurate variant pricing."
                  style={{
                    marginRight: '0.125rem',
                    color: '#718096',
                    fontWeight: 400,
                  }}
                >
                  ~
                </span>
              )}
              {formatBrl(totalCostCents)}{' '}
              {isEstimated && (
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    color: '#718096',
                    backgroundColor: '#edf2f7',
                    border: '1px solid #e2e8f0',
                    borderRadius: '3px',
                    padding: '0 0.3em',
                    marginRight: '0.25rem',
                    verticalAlign: 'middle',
                    lineHeight: '1.4',
                  }}
                  data-testid="estimated-badge"
                >
                  estimated
                </span>
              )}{' '}
              at {storeName} you close{' '}
              {availableCardCount} of {totalMissing} missing{' '}
              {totalMissing === 1 ? 'card' : 'cards'}.
              {veryStale && (
                <span
                  style={{
                    marginLeft: '0.5rem',
                    color: '#c53030',
                    fontSize: '0.8125rem',
                    fontWeight: 400,
                  }}
                >
                  (prices may have changed)
                </span>
              )}
            </p>
          ) : (
            <p
              style={{
                margin: 0,
                color: '#718096',
                fontSize: '0.875rem',
              }}
            >
              No missing cards currently in stock at {storeName}.
            </p>
          )}
        </div>

        {/* No-stock CTA */}
        {availableCardCount === 0 && (
          <p
            style={{
              margin: '0.5rem 0 0',
              fontSize: '0.8125rem',
              color: '#718096',
            }}
          >
            last checked {relativeTime} &mdash;{' '}
            <a
              href="#breakdown"
              style={{ color: '#3182ce', textDecoration: 'underline' }}
            >
              Try the substitution editor to find alternatives
            </a>
          </p>
        )}

        {/* Progress indicator: shown while fetch is in progress */}
        {showProgress && variantFetchProgress !== undefined && (
          <VariantFetchProgress progress={variantFetchProgress} />
        )}

        {/* Partial failure notice: shown after fetch completes with some failures */}
        {showRetryFailed && variantFetchProgress !== undefined && (
          <PartialFailureNotice
            progress={variantFetchProgress}
            onRetry={onFetchVariants!}
            isPending={isPending}
          />
        )}

        {/* "Get exact prices" CTA or cooldown message */}
        {showCta && (
          isCooldownActive ? (
            <p
              style={{
                margin: '0.5rem 0 0',
                fontSize: '0.8125rem',
                color: '#718096',
              }}
            >
              Prices are up to date.
            </p>
          ) : (
            <VariantFetchCta
              onGetExactPrices={onFetchVariants!}
              isPending={isPending}
              isError={isMutationError}
            />
          )
        )}
      </div>

      {/* Card list */}
      {lines.length > 0 && (
        <div style={{ padding: '0 1rem 1rem' }}>
          {availableLines.length > 0 && (
            <LineGroup
              label={`In stock (${availableLines.length})`}
              lines={availableLines}
              storeHostname={storeHostname}
              storeName={storeName}
              muted={false}
            />
          )}

          {unavailableLines.length > 0 && (
            <LineGroup
              label={`Unavailable (${unavailableLines.length})`}
              lines={unavailableLines}
              storeHostname={storeHostname}
              storeName={storeName}
              muted={true}
            />
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Variant fetch CTA button
// ---------------------------------------------------------------------------

interface IVariantFetchCtaProps {
  readonly onGetExactPrices: () => void;
  readonly isPending: boolean;
  readonly isError: boolean;
}

function VariantFetchCta({ onGetExactPrices, isPending, isError }: IVariantFetchCtaProps) {
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

// ---------------------------------------------------------------------------
// Progress indicator (shown while fetch is active)
// ---------------------------------------------------------------------------

interface IVariantFetchProgressProps {
  readonly progress: IVariantFetchProgress;
}

function VariantFetchProgress({ progress }: IVariantFetchProgressProps) {
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

// ---------------------------------------------------------------------------
// Partial failure notice (shown after fetch completes with failures)
// ---------------------------------------------------------------------------

interface IPartialFailureNoticeProps {
  readonly progress: IVariantFetchProgress;
  readonly onRetry: () => void;
  readonly isPending: boolean;
}

function PartialFailureNotice({
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

// ---------------------------------------------------------------------------
// Line group (in stock / unavailable sub-sections)
// ---------------------------------------------------------------------------

interface ILineGroupProps {
  readonly label: string;
  readonly lines: readonly IShoppingLineLine[];
  readonly storeHostname: string;
  readonly storeName: string;
  readonly muted: boolean;
}

function LineGroup({ label, lines, storeHostname, storeName, muted }: ILineGroupProps) {
  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: muted ? '#a0aec0' : '#4a5568',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '0.375rem',
          paddingBottom: '0.25rem',
          borderBottom: '1px solid #edf2f7',
        }}
      >
        {label}
      </div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          opacity: muted ? 0.6 : 1,
        }}
      >
        {lines.map((line) => (
          <LineItem
            key={line.cardIdentifier}
            line={line}
            storeHostname={storeHostname}
            storeName={storeName}
            muted={muted}
          />
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual line item
// ---------------------------------------------------------------------------

interface ILineItemProps {
  readonly line: IShoppingLineLine;
  readonly storeHostname: string;
  readonly storeName: string;
  readonly muted: boolean;
}

/**
 * Returns true when the finish string represents a foil finish.
 * 'Non-foil' is the only non-foil value; everything else is foil.
 */
function isFoilFinish(finish: string): boolean {
  return finish.toLowerCase() !== 'non-foil';
}

/**
 * Formats a variant's price with condition annotation and optional foil suffix.
 * Example: "R$ 0,35 (NM)" or "R$ 0,80 (NM, Foil)"
 */
function formatVariantPrice(variant: IShoppingLineVariant): string {
  const price = formatBrl(variant.priceCents);
  const foilSuffix = isFoilFinish(variant.finish) ? ', Foil' : '';
  return `${price} (${variant.condition}${foilSuffix})`;
}

function LineItem({ line, storeHostname, storeName, muted }: ILineItemProps) {
  const {
    cardName,
    quantityNeeded,
    quantityAvailable,
    unitPriceCents,
    productUrl,
    hasVariantData,
    variants,
    verificationStatus,
  } = line;

  // Determine if this is a partially available line:
  // variant data exists, some copies in stock, but fewer than needed.
  const isPartiallyAvailable =
    hasVariantData === true &&
    quantityAvailable > 0 &&
    quantityAvailable < quantityNeeded;

  // Determine unavailable sub-state
  const isVerifiedZero = verificationStatus === 'verified_zero';

  // Build quantity label
  const quantityLabel: string = (() => {
    if (isPartiallyAvailable) {
      return `${quantityAvailable} of ${quantityNeeded} copies available`;
    }
    if (quantityAvailable >= quantityNeeded) {
      return `${quantityNeeded} of ${quantityNeeded}`;
    }
    return `${quantityAvailable} of ${quantityNeeded} in stock`;
  })();

  // Build primary price label
  const cheapestVariant = hasVariantData && variants && variants.length >= 1
    ? variants[0]
    : undefined;

  const priceLabel: string = (() => {
    // Variant data takes precedence: if the backend provided variants, they hold
    // the authoritative price even when the listing-level unitPriceCents is null
    // (e.g., a card where the listing price is "under request" but variants exist).
    if (cheapestVariant !== undefined) {
      // Cheapest variant is first (sorted ascending by priceCents on backend)
      return formatVariantPrice(cheapestVariant);
    }
    if (unitPriceCents === null) return 'price on request';
    // Listing-only or no variant data — use tilde prefix
    return `~${formatBrl(unitPriceCents)}`;
  })();

  // Build unavailable status label
  const unavailableLabel = isVerifiedZero ? 'Out of stock (verified)' : 'not in stock';

  const hasExpandableVariants = Boolean(
    hasVariantData && variants && variants.length > 1,
  );
  const additionalVariantCount = variants ? variants.length - 1 : 0;

  return (
    <li
      style={{
        padding: '0.5rem 0',
        borderBottom: '1px solid #f7fafc',
        fontSize: '0.875rem',
        color: muted ? '#a0aec0' : '#2d3748',
      }}
    >
      {/* Main row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontWeight: 500, flexGrow: 1, minWidth: '8rem' }}>
          {cardName}
        </span>

        <span
          style={{
            color: muted ? '#a0aec0' : '#718096',
            fontSize: '0.8125rem',
            whiteSpace: 'nowrap',
          }}
        >
          {quantityLabel}
        </span>

        <span
          style={{
            fontWeight: muted ? 400 : 600,
            color: muted ? '#a0aec0' : '#2d3748',
            whiteSpace: 'nowrap',
          }}
        >
          {muted ? (
            <span style={{ color: '#a0aec0' }}>{unavailableLabel}</span>
          ) : (
            priceLabel
          )}
        </span>

        {!muted && productUrl && (
          <StoreProductLink
            url={productUrl}
            storeHostname={storeHostname}
            storeName={storeName}
            cardName={cardName}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: '#3182ce',
                textDecoration: 'underline',
              }}
            >
              View
            </span>
          </StoreProductLink>
        )}
      </div>

      {/* Expandable variant breakdown */}
      {/* hasExpandableVariants already guards variants !== undefined */}
      {hasExpandableVariants && variants && (
        <details
          data-testid="variant-breakdown-details"
          style={{ marginTop: '0.25rem' }}
        >
          <summary
            style={{
              cursor: 'pointer',
              fontSize: '0.75rem',
              color: '#3182ce',
              listStyle: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              userSelect: 'none',
            }}
          >
            {additionalVariantCount} more variant{additionalVariantCount !== 1 ? 's' : ''}
          </summary>
          <VariantBreakdownTable variants={variants} />
        </details>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Variant breakdown table
// ---------------------------------------------------------------------------

interface IVariantBreakdownTableProps {
  readonly variants: readonly IShoppingLineVariant[];
}

function VariantBreakdownTable({ variants }: IVariantBreakdownTableProps) {
  return (
    <table
      style={{
        marginTop: '0.375rem',
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.75rem',
        color: '#4a5568',
      }}
    >
      <thead>
        <tr>
          <th
            scope="col"
            style={{
              textAlign: 'left',
              fontWeight: 600,
              padding: '0.25rem 0.375rem 0.25rem 0',
              borderBottom: '1px solid #edf2f7',
              whiteSpace: 'nowrap',
            }}
          >
            Edition
          </th>
          <th
            scope="col"
            style={{
              textAlign: 'left',
              fontWeight: 600,
              padding: '0.25rem 0.375rem',
              borderBottom: '1px solid #edf2f7',
              whiteSpace: 'nowrap',
            }}
          >
            Condition
          </th>
          <th
            scope="col"
            style={{
              textAlign: 'left',
              fontWeight: 600,
              padding: '0.25rem 0.375rem',
              borderBottom: '1px solid #edf2f7',
              whiteSpace: 'nowrap',
            }}
          >
            Finish
          </th>
          <th
            scope="col"
            style={{
              textAlign: 'right',
              fontWeight: 600,
              padding: '0.25rem 0.375rem',
              borderBottom: '1px solid #edf2f7',
              whiteSpace: 'nowrap',
            }}
          >
            Price
          </th>
          <th
            scope="col"
            style={{
              textAlign: 'right',
              fontWeight: 600,
              padding: '0.25rem 0 0.25rem 0.375rem',
              borderBottom: '1px solid #edf2f7',
              whiteSpace: 'nowrap',
            }}
          >
            Qty
          </th>
        </tr>
      </thead>
      <tbody>
        {variants.map((v, idx) => (
          <VariantRow key={`${v.edition}-${v.condition}-${v.finish}-${idx}`} variant={v} />
        ))}
      </tbody>
    </table>
  );
}

interface IVariantRowProps {
  readonly variant: IShoppingLineVariant;
}

function VariantRow({ variant }: IVariantRowProps) {
  const finishLabel = isFoilFinish(variant.finish) ? variant.finish : 'Non-foil';

  return (
    <tr>
      <td
        style={{
          padding: '0.25rem 0.375rem 0.25rem 0',
          borderBottom: '1px solid #f7fafc',
          maxWidth: '12rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={variant.edition}
      >
        {variant.edition}
      </td>
      <td
        style={{
          padding: '0.25rem 0.375rem',
          borderBottom: '1px solid #f7fafc',
          whiteSpace: 'nowrap',
        }}
      >
        {variant.condition}
      </td>
      <td
        style={{
          padding: '0.25rem 0.375rem',
          borderBottom: '1px solid #f7fafc',
          whiteSpace: 'nowrap',
        }}
      >
        {finishLabel}
      </td>
      <td
        style={{
          padding: '0.25rem 0.375rem',
          borderBottom: '1px solid #f7fafc',
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}
      >
        {formatBrl(variant.priceCents)}
      </td>
      <td
        style={{
          padding: '0.25rem 0 0.25rem 0.375rem',
          borderBottom: '1px solid #f7fafc',
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        {variant.quantity}
      </td>
    </tr>
  );
}
