import {
  IShoppingLinePopulated,
  IShoppingLineResponse,
  IShoppingLineLine,
} from '../api/shopping-line';
import { formatBrl } from '../utils/format-brl';
import { formatRelativeTime, isStale, isVeryStale } from '../utils/format-relative-time';
import { StoreProductLink } from './StoreProductLink';

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
 * The headline affordance is wrapped in aria-live="polite" so screen
 * readers announce updates after substitute rejection (D10).
 */
export function ShoppingLine({ data }: IShoppingLineProps) {
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
  return <PopulatedShoppingLine data={data} />;
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
}

function PopulatedShoppingLine({ data }: IPopulatedProps) {
  const {
    storeName,
    storeHostname,
    totalCostCents,
    availableCardCount,
    unavailableCardCount,
    lines,
    lastFetchedAt,
  } = data;

  const totalMissing = availableCardCount + unavailableCardCount;
  const relativeTime = formatRelativeTime(lastFetchedAt);
  const stale = isStale(lastFetchedAt);
  const veryStale = isVeryStale(lastFetchedAt);

  const freshnessColor = veryStale ? '#c53030' : stale ? '#b7791f' : '#718096';

  const availableLines = lines.filter((l) => l.quantityAvailable > 0);
  const unavailableLines = lines.filter((l) => l.quantityAvailable === 0);

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
              With {formatBrl(totalCostCents)} at {storeName} you close{' '}
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

function LineItem({ line, storeHostname, storeName, muted }: ILineItemProps) {
  const { cardName, quantityNeeded, quantityAvailable, unitPriceCents, productUrl } = line;

  const quantityLabel =
    quantityAvailable >= quantityNeeded
      ? `${quantityNeeded} of ${quantityNeeded}`
      : `${quantityAvailable} of ${quantityNeeded} in stock`;

  const priceLabel =
    unitPriceCents === null
      ? 'price on request'
      : formatBrl(unitPriceCents);

  return (
    <li
      style={{
        padding: '0.5rem 0',
        borderBottom: '1px solid #f7fafc',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        flexWrap: 'wrap',
        fontSize: '0.875rem',
        color: muted ? '#a0aec0' : '#2d3748',
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
          <span style={{ color: '#a0aec0' }}>not in stock</span>
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
    </li>
  );
}
