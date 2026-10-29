import { useTranslation } from 'react-i18next';
import {
  IShoppingLinePopulated,
  IShoppingLineResponse,
  IShoppingLineLine,
} from '../api/shopping-line';
import { formatBrl } from '../utils/format-brl';
import { formatRelativeTime, isStale, isVeryStale } from '../utils/format-relative-time';
import { cardName as namedCard } from '../lib/card-name';
import { StoreProductLink } from './StoreProductLink';
import { VariantBreakdownTable } from './ShoppingLineVariantBreakdown';
import { formatVariantPrice } from './ShoppingLineVariantBreakdown.helpers';
import styles from './ShoppingLine.module.css';

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
 *
 * The headline affordance is wrapped in aria-live="polite" so screen
 * readers announce updates after substitute rejection (D10).
 */
export function ShoppingLine({ data, onRetry }: IShoppingLineProps) {
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
  return <PopulatedShoppingLine data={data} />;
}

// Empty state (Path A)

function PathAEmptyState() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={styles.pathAEmpty}
    >
      {t('decks.shoppingPathAEmpty')}
    </div>
  );
}

// Error state

interface IErrorStateProps {
  readonly onRetry?: () => void;
  readonly message?: string;
}

function ErrorState({ onRetry, message }: IErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className={styles.errorState}
    >
      <span>{message ?? t('decks.shoppingUnavailable')}</span>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className={styles.errorRetryBtn}
        >
          {t('decks.retry')}
        </button>
      )}
    </div>
  );
}

// Populated state

interface IPopulatedProps {
  readonly data: IShoppingLinePopulated;
}

function PopulatedShoppingLine({ data }: IPopulatedProps) {
  const { t } = useTranslation();
  const {
    storeName,
    storeHostname,
    totalCostCents,
    availableCardCount,
    unavailableCardCount,
    lines,
    lastFetchedAt,
    isEstimated,
  } = data;

  const totalMissing = availableCardCount + unavailableCardCount;
  const relativeTime = formatRelativeTime(lastFetchedAt, t);
  const stale = isStale(lastFetchedAt);
  const veryStale = isVeryStale(lastFetchedAt);

  // Freshness state: drives data-freshness attribute selector on the timestamp span
  const freshnessKey = veryStale ? 'very-stale' : stale ? 'stale' : 'ok';

  const availableLines = lines.filter((l) => l.quantityAvailable > 0);
  const unavailableLines = lines.filter((l) => l.quantityAvailable === 0);

  return (
    <section
      aria-label={t('decks.shoppingLineAria')}
      className={styles.section}
    >
      {/* Section header */}
      <header className={styles.header}>
        <h2 className={styles.headerTitle}>
          {t('decks.shoppingLineTitle', { storeName })}
        </h2>
        <span
          className={styles.headerFreshness}
          data-freshness={freshnessKey}
        >
          {t('decks.shoppingUpdated', { when: relativeTime })}
          {veryStale && t('decks.pricesMayHaveChanged')}
        </span>
      </header>

      {/* Headline affordance */}
      <div className={styles.headline}>
        <div aria-live="polite">
          {availableCardCount > 0 ? (
            <p className={styles.headlinePrimary}>
              {t('decks.shoppingHeadlineWith')}
              {isEstimated && (
                <span aria-label={t('decks.estimatedPriceAria')} className={styles.estimateTilde}>
                  ~
                </span>
              )}
              {formatBrl(totalCostCents)}{' '}
              {isEstimated && (
                <span
                  className={styles.estimatedBadge}
                  data-testid="estimated-badge"
                >
                  {t('decks.estimated')}
                </span>
              )}{' '}
              {t('decks.shoppingHeadlineAt', { storeName })}{' '}
              {availableCardCount}{' '}
              {t('decks.shoppingHeadlineMissingCards', { count: totalMissing, total: totalMissing })}.
              {veryStale && (
                <span className={styles.headlineStaleWarning}>
                  {t('decks.pricesMayHaveChanged')}
                </span>
              )}
            </p>
          ) : (
            <p className={styles.headlineEmpty}>
              {t('decks.shoppingHeadlineEmpty', { storeName })}
            </p>
          )}
        </div>

        {isEstimated && availableCardCount > 0 && (
          <p className={styles.estimateNote} data-testid="estimate-note">
            {t('decks.estimatedPriceTooltip')}
          </p>
        )}

        {/* No-stock CTA */}
        {availableCardCount === 0 && (
          <p className={styles.noStockCta}>
            {t('decks.shoppingLastChecked', { when: relativeTime })}
          </p>
        )}
      </div>

      {/* Card list */}
      {lines.length > 0 && (
        <div className={styles.cardList}>
          {availableLines.length > 0 && (
            <LineGroup
              label={t('decks.inStockGroup', { count: availableLines.length })}
              lines={availableLines}
              storeHostname={storeHostname}
              storeName={storeName}
              muted={false}
            />
          )}

          {unavailableLines.length > 0 && (
            <LineGroup
              label={t('decks.unavailableGroup', { count: unavailableLines.length })}
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

// Line group (in stock / unavailable sub-sections)

interface ILineGroupProps {
  readonly label: string;
  readonly lines: readonly IShoppingLineLine[];
  readonly storeHostname: string;
  readonly storeName: string;
  readonly muted: boolean;
}

function LineGroup({
  label,
  lines,
  storeHostname,
  storeName,
  muted,
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

// Individual line item

interface ILineItemProps {
  readonly line: IShoppingLineLine;
  readonly storeHostname: string;
  readonly storeName: string;
  readonly muted: boolean;
}

function LineItem({
  line,
  storeHostname,
  storeName,
  muted,
}: ILineItemProps) {
  const { t } = useTranslation();
  const {
    cardName: catalogName,
    pitch,
    quantityNeeded,
    quantityAvailable,
    unitPriceCents,
    productUrl,
    hasVariantData,
    variants,
    verificationStatus,
  } = line;

  const cardName = namedCard(catalogName, pitch, t);

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
      return t('decks.quantityCopiesAvailable', { available: quantityAvailable, needed: quantityNeeded });
    }
    if (quantityAvailable >= quantityNeeded) {
      return t('decks.quantityOfNeeded', { available: quantityNeeded, needed: quantityNeeded });
    }
    return t('decks.quantityInStock', { available: quantityAvailable, needed: quantityNeeded });
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
    if (unitPriceCents === null) return t('decks.priceOnRequest');
    // Listing-only or no variant data — use tilde prefix
    return `~${formatBrl(unitPriceCents)}`;
  })();

  // Build unavailable status label
  const unavailableLabel = isVerifiedZero ? t('decks.outOfStockVerified') : t('decks.notInStock');

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
              {t('decks.viewLink')}
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
            {t('decks.variantMoreCount', { count: additionalVariantCount })}
          </summary>
          <VariantBreakdownTable variants={variants} />
        </details>
      )}
    </li>
  );
}
