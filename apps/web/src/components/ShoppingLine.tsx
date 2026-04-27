import { useState, useEffect } from 'react';
import {
  IShoppingLinePopulated,
  IShoppingLineResponse,
  IShoppingLineLine,
  TCardFetchStatus,
} from '../api/shopping-line';
import { VARIANT_FETCH_POLL_TIMEOUT_MS } from '../api/deck-detail';
import { formatBrl } from '../utils/format-brl';
import { formatRelativeTime, isStale, isVeryStale } from '../utils/format-relative-time';
import { StoreProductLink } from './StoreProductLink';
import {
  VariantBreakdownTable,
  formatVariantPrice,
} from './ShoppingLineVariantBreakdown';
import {
  VariantFetchCta,
  VariantFetchProgress,
  PartialFailureNotice,
} from './ShoppingLineFetchControls';
import styles from './ShoppingLine.module.css';

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
  /**
   * Called when the user clicks "Retry" in the error state.
   * The host route owns error recovery (TanStack Query invalidation / refetch).
   * ShoppingLine does NOT import the Toast hook — error notification is the
   * host's responsibility.
   */
  readonly onRetry?: () => void;
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
  onRetry,
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
    return <ErrorState {...(onRetry !== undefined ? { onRetry } : {})} />;
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

// Empty state (Path A)

function PathAEmptyState() {
  return (
    <div
      role="status"
      className={styles.pathAEmpty}
    >
      You have everything you need for this deck.
    </div>
  );
}

// Error state

interface IErrorStateProps {
  readonly onRetry?: () => void;
  readonly message?: string;
}

function ErrorState({ onRetry, message }: IErrorStateProps) {
  return (
    <div
      role="status"
      className={styles.errorState}
    >
      <span>{message ?? 'Shopping line temporarily unavailable.'}</span>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className={styles.errorRetryBtn}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// Populated state

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

  // Freshness state: drives data-freshness attribute selector on the timestamp span
  const freshnessKey = veryStale ? 'very-stale' : stale ? 'stale' : 'ok';

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
      className={styles.section}
    >
      {/* Section header */}
      <header className={styles.header}>
        <h2 className={styles.headerTitle}>
          Shopping line &middot; {storeName}
        </h2>
        <span
          className={styles.headerFreshness}
          data-freshness={freshnessKey}
          title={lastFetchedAt}
        >
          updated {relativeTime}
          {veryStale && ' (prices may have changed)'}
        </span>
      </header>

      {/* Headline affordance */}
      <div className={styles.headline}>
        <div aria-live="polite">
          {availableCardCount > 0 ? (
            <p className={styles.headlinePrimary}>
              With{' '}
              {isEstimated && (
                <span
                  aria-label="estimated price"
                  title="Price is estimated from listing data. Click 'Get exact prices' for accurate variant pricing."
                  className={styles.estimateTilde}
                >
                  ~
                </span>
              )}
              {formatBrl(totalCostCents)}{' '}
              {isEstimated && (
                <span
                  className={styles.estimatedBadge}
                  data-testid="estimated-badge"
                >
                  estimated
                </span>
              )}{' '}
              at {storeName} you close{' '}
              {availableCardCount} of {totalMissing} missing{' '}
              {totalMissing === 1 ? 'card' : 'cards'}.
              {veryStale && (
                <span className={styles.headlineStaleWarning}>
                  (prices may have changed)
                </span>
              )}
            </p>
          ) : (
            <p className={styles.headlineEmpty}>
              No missing cards currently in stock at {storeName}.
            </p>
          )}
        </div>

        {/* No-stock CTA */}
        {availableCardCount === 0 && (
          <p className={styles.noStockCta}>
            last checked {relativeTime} &mdash;{' '}
            <a
              href="#breakdown"
              className={styles.noStockCtaLink}
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
            <p className={styles.cooldownMsg}>
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
        <div className={styles.cardList}>
          {availableLines.length > 0 && (
            <LineGroup
              label={`In stock (${availableLines.length})`}
              lines={availableLines}
              storeHostname={storeHostname}
              storeName={storeName}
              muted={false}
              {...(variantFetchProgress?.cards !== undefined
                ? { cardFetchStatus: variantFetchProgress.cards }
                : {})}
            />
          )}

          {unavailableLines.length > 0 && (
            <LineGroup
              label={`Unavailable (${unavailableLines.length})`}
              lines={unavailableLines}
              storeHostname={storeHostname}
              storeName={storeName}
              muted={true}
              {...(variantFetchProgress?.cards !== undefined
                ? { cardFetchStatus: variantFetchProgress.cards }
                : {})}
            />
          )}
        </div>
      )}
    </section>
  );
}

// Line group (in stock / unavailable sub-sections)

interface ILineGroupProps {
  readonly label: string;
  readonly lines: readonly IShoppingLineLine[];
  readonly storeHostname: string;
  readonly storeName: string;
  readonly muted: boolean;
  readonly cardFetchStatus?: Readonly<Record<string, TCardFetchStatus>>;
}

function LineGroup({
  label,
  lines,
  storeHostname,
  storeName,
  muted,
  cardFetchStatus,
}: ILineGroupProps) {
  return (
    <div className={styles.lineGroup}>
      <div
        className={styles.lineGroupLabel}
        data-muted={String(muted)}
      >
        {label}
      </div>
      <ul
        className={styles.lineList}
        data-muted={String(muted)}
      >
        {lines.map((line) => {
          const status = cardFetchStatus?.[line.cardIdentifier];
          return (
            <LineItem
              key={line.cardIdentifier}
              line={line}
              storeHostname={storeHostname}
              storeName={storeName}
              muted={muted}
              {...(status !== undefined ? { fetchStatus: status } : {})}
            />
          );
        })}
      </ul>
    </div>
  );
}

// Individual line item

interface ILineItemProps {
  readonly line: IShoppingLineLine;
  readonly storeHostname: string;
  readonly storeName: string;
  readonly muted: boolean;
  readonly fetchStatus?: TCardFetchStatus;
}

function LineItem({
  line,
  storeHostname,
  storeName,
  muted,
  fetchStatus,
}: ILineItemProps) {
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
      className={styles.lineItem}
      data-muted={String(muted)}
    >
      {/* Main row */}
      <div className={styles.lineItemRow}>
        <span className={styles.lineItemName}>
          {cardName}
          {fetchStatus === 'failed' && (
            <span
              role="status"
              aria-label={`Failed to fetch variants for ${cardName}`}
              data-testid="line-item-fetch-failed"
              className={styles.lineItemFailedBadge}
            >
              failed
            </span>
          )}
        </span>

        <span
          className={styles.lineItemQty}
          data-muted={String(muted)}
        >
          {quantityLabel}
        </span>

        <span
          className={styles.lineItemPrice}
          data-muted={String(muted)}
        >
          {muted ? (
            <span>{unavailableLabel}</span>
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
            <span className={styles.lineItemViewLink}>
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
          className={styles.variantDetails}
        >
          <summary className={styles.variantSummary}>
            {additionalVariantCount} more variant{additionalVariantCount !== 1 ? 's' : ''}
          </summary>
          <VariantBreakdownTable variants={variants} />
        </details>
      )}
    </li>
  );
}
