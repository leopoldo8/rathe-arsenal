import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShoppingLine } from '../ShoppingLine';
import { computeVariantFetchInterval, VARIANT_FETCH_POLL_TIMEOUT_MS } from '../../api/deck-detail';
import {
  IShoppingLinePopulated,
  IVariantFetchProgress,
} from '../../api/shopping-line';
import type { IDeckDetailResponse } from '../../api/deck-detail';

/**
 * Estimated badge and the deck-detail refetch interval.
 *
 *  3. Estimated badge appears with listing-only data, disappears after all
 *     cards have variants
 *  7. Polling stops when inProgress === false
 *  8. Polling stops when variantFetchProgress is absent (pod-restart simulation)
 *  9. Polling stops after 5-minute safety timeout
 */

const NOW_MS = new Date('2026-04-12T12:00:00.000Z').getTime();
const TWO_HOURS_AGO = new Date(NOW_MS - 2 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
  vi.useFakeTimers({ now: NOW_MS });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_LINE = {
  cardIdentifier: 'rhinar-brute-of-brokenbone',
  cardName: 'Rhinar, Brute of Brokenbone',
  pitch: null,
  quantityNeeded: 2,
  quantityAvailable: 2,
  unitPriceCents: 4990,
  productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=1',
  lastFetchedAt: TWO_HOURS_AGO,
  hasVariantData: false,
} as const;

const SECOND_LINE = {
  cardIdentifier: 'pummel',
  cardName: 'Pummel',
  pitch: null,
  quantityNeeded: 1,
  quantityAvailable: 0,
  unitPriceCents: null,
  productUrl: '',
  lastFetchedAt: TWO_HOURS_AGO,
  hasVariantData: false,
} as const;

/**
 * Build a populated shopping line fixture with optional overrides.
 *
 * Note: with `exactOptionalPropertyTypes`, passing `undefined` explicitly for
 * an optional field is a type error. Use the dedicated helpers
 * `makePopulatedWithoutEstimated` and `makePopulatedWithoutProgress` when
 * you need to test responses that lack these optional fields entirely.
 */
function makePopulated(
  overrides: Omit<Partial<IShoppingLinePopulated>, 'isEstimated' | 'variantFetchProgress'> & {
    isEstimated?: boolean;
    variantFetchProgress?: IVariantFetchProgress;
  } = {},
): IShoppingLinePopulated {
  const { isEstimated, variantFetchProgress, ...rest } = overrides;
  const base: IShoppingLinePopulated = {
    kind: 'populated',
    storeName: 'Cupula DT',
    storeHostname: 'www.cupuladt.com.br',
    totalCostCents: 9980,
    availableCardCount: 1,
    unavailableCardCount: 1,
    lines: [BASE_LINE, SECOND_LINE],
    lastFetchedAt: TWO_HOURS_AGO,
    ...rest,
  };
  if (isEstimated !== undefined) {
    return { ...base, isEstimated, ...(variantFetchProgress !== undefined ? { variantFetchProgress } : {}) };
  }
  if (variantFetchProgress !== undefined) {
    return { ...base, variantFetchProgress };
  }
  return base;
}

function makeProgress(
  overrides: Partial<IVariantFetchProgress> = {},
): IVariantFetchProgress {
  return {
    fetchId: 'test-fetch-id',
    total: 12,
    completed: 0,
    failed: 0,
    inProgress: true,
    ...overrides,
  };
}

describe('Scenario 3: estimated badge lifecycle', () => {
  it('renders the "estimated" badge when isEstimated is true', () => {
    const data = makePopulated({ isEstimated: true });

    render(<ShoppingLine data={data} />);

    expect(screen.getByTestId('estimated-badge')).toBeInTheDocument();
    expect(screen.getByTestId('estimated-badge')).toHaveTextContent('estimado');
  });

  it('renders a tilde prefix on the price when isEstimated is true', () => {
    const data = makePopulated({ isEstimated: true });

    render(<ShoppingLine data={data} />);

    // The tilde is in a separate span with aria-label="estimated price"
    expect(screen.getByLabelText(/preço estimado/i)).toHaveTextContent('~');
  });

  it('does not render the "estimated" badge when isEstimated is false', () => {
    const data = makePopulated({ isEstimated: false });

    render(<ShoppingLine data={data} />);

    expect(screen.queryByTestId('estimated-badge')).not.toBeInTheDocument();
  });

  it('does not render the tilde when isEstimated is false', () => {
    const data = makePopulated({ isEstimated: false });

    render(<ShoppingLine data={data} />);

    expect(screen.queryByLabelText(/preço estimado/i)).not.toBeInTheDocument();
  });

  it('does not render the estimated badge when isEstimated is absent (older responses)', () => {
    // makePopulated without isEstimated override omits the field entirely
    const data = makePopulated();

    render(<ShoppingLine data={data} />);

    expect(screen.queryByTestId('estimated-badge')).not.toBeInTheDocument();
  });
});

describe('computeVariantFetchInterval: polling stop conditions', () => {
  function makeDeckDetail(
    shoppingLineOverrides: Partial<IShoppingLinePopulated> = {},
  ): IDeckDetailResponse {
    return {
      id: 1,
      fabraryUlid: 'ulid-001',
      name: 'Test Deck',
      hero: 'Rhinar',
      heroIdentifier: null,
      format: 'Blitz',
      trackedAt: TWO_HOURS_AGO,
      updatedAt: TWO_HOURS_AGO,
      status: 'building',
      tags: [],
      notes: null,
      legality: { category: 'legal', reasons: [] },
      totalCards: 40,
      latestSnapshot: null,
      replacements: [],
      shoppingLine: makePopulated(shoppingLineOverrides),
    };
  }

  // Scenario 7: polling stops when inProgress === false
  it('Scenario 7: returns false when variantFetchProgress.inProgress is false', () => {
    const data = makeDeckDetail({
      isEstimated: true,
      variantFetchProgress: makeProgress({ inProgress: false }),
    });

    const result = computeVariantFetchInterval(data, NOW_MS);

    expect(result).toBe(false);
  });

  it('returns 3000 when fetch is actively in progress', () => {
    const data = makeDeckDetail({
      isEstimated: true,
      variantFetchProgress: makeProgress({ inProgress: true }),
    });

    const result = computeVariantFetchInterval(data, NOW_MS);

    expect(result).toBe(3_000);
  });

  // Scenario 8: CRITICAL — polling stops when variantFetchProgress is absent
  it('Scenario 8 (CRITICAL): returns false when variantFetchProgress is absent (pod restart)', () => {
    // Simulate a pod restart: isEstimated is still true (listing data only),
    // but variantFetchProgress is absent because the in-memory tracker was
    // lost on restart. Polling MUST stop — do NOT rely on inProgress === false.
    // Use makePopulated with isEstimated: true but no variantFetchProgress.
    const data = makeDeckDetail({ isEstimated: true });

    const result = computeVariantFetchInterval(data, NOW_MS);

    expect(result).toBe(false);
  });

  it('Scenario 8 (CRITICAL): returns false when shoppingLine is absent', () => {
    // IDeckDetailResponse.shoppingLine is optional; omit it from the spread
    // rather than passing undefined (exactOptionalPropertyTypes).
    const dataWithoutShoppingLine: IDeckDetailResponse = {
      id: 1,
      fabraryUlid: 'ulid-001',
      name: 'Test Deck',
      hero: 'Rhinar',
      heroIdentifier: null,
      format: 'Blitz',
      trackedAt: TWO_HOURS_AGO,
      updatedAt: TWO_HOURS_AGO,
      status: 'building',
      tags: [],
      notes: null,
      legality: { category: 'legal', reasons: [] },
      totalCards: 40,
      latestSnapshot: null,
      replacements: [],
    };

    const result = computeVariantFetchInterval(dataWithoutShoppingLine, NOW_MS);

    expect(result).toBe(false);
  });

  it('Scenario 8 (CRITICAL): returns false when data is undefined', () => {
    const result = computeVariantFetchInterval(undefined, NOW_MS);

    expect(result).toBe(false);
  });

  // Scenario 9: polling stops after 5-minute safety timeout
  it('Scenario 9: returns false when 5-minute timeout has elapsed', () => {
    const data = makeDeckDetail({
      isEstimated: true,
      variantFetchProgress: makeProgress({ inProgress: true }),
    });

    // Polling started at NOW_MS, but 5 minutes have elapsed.
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS + VARIANT_FETCH_POLL_TIMEOUT_MS);

    const result = computeVariantFetchInterval(data, NOW_MS);

    expect(result).toBe(false);
  });

  it('Scenario 9: still polls when just under the 5-minute timeout', () => {
    const data = makeDeckDetail({
      isEstimated: true,
      variantFetchProgress: makeProgress({ inProgress: true }),
    });

    // One millisecond short of the timeout
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS + VARIANT_FETCH_POLL_TIMEOUT_MS - 1);

    const result = computeVariantFetchInterval(data, NOW_MS);

    expect(result).toBe(3_000);
  });

  it('Scenario 9: continues polling when pollingStartedAt is undefined (timeout not tracking)', () => {
    const data = makeDeckDetail({
      isEstimated: true,
      variantFetchProgress: makeProgress({ inProgress: true }),
    });

    // Even if a lot of time has passed, without a pollingStartedAt we cannot
    // enforce the timeout.
    vi.spyOn(Date, 'now').mockReturnValue(NOW_MS + VARIANT_FETCH_POLL_TIMEOUT_MS * 10);

    const result = computeVariantFetchInterval(data, undefined);

    expect(result).toBe(3_000);
  });

  // Stop condition 3: isEstimated === false
  it('returns false when isEstimated is false (all cards have variant data)', () => {
    const data = makeDeckDetail({
      isEstimated: false,
      variantFetchProgress: makeProgress({ inProgress: true }),
    });

    const result = computeVariantFetchInterval(data, NOW_MS);

    expect(result).toBe(false);
  });

  // shoppingLine is not populated kind
  it('returns false when shoppingLine is unscraped', () => {
    const data: IDeckDetailResponse = {
      id: 1,
      fabraryUlid: 'ulid-001',
      name: 'Test Deck',
      hero: 'Rhinar',
      heroIdentifier: null,
      format: 'Blitz',
      trackedAt: TWO_HOURS_AGO,
      updatedAt: TWO_HOURS_AGO,
      status: 'building',
      tags: [],
      notes: null,
      legality: { category: 'legal', reasons: [] },
      totalCards: 40,
      latestSnapshot: null,
      replacements: [],
      shoppingLine: { kind: 'unscraped' },
    };

    const result = computeVariantFetchInterval(data, NOW_MS);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// onPollingChange callback integration tests
// ---------------------------------------------------------------------------

describe('backward compatibility: existing 6 states unaffected', () => {
  it('null (Path A) still renders success empty state', () => {
    render(<ShoppingLine data={null} />);
    expect(screen.getByText(/você já tem tudo o que este deck precisa/i)).toBeInTheDocument();
  });

  it('unscraped still renders nothing', () => {
    const { container } = render(<ShoppingLine data={{ kind: 'unscraped' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('error still renders degraded state', () => {
    render(<ShoppingLine data={{ kind: 'error', reason: 'db_error' }} />);
    expect(screen.getByText(/a lista de compras está indisponível agora/i)).toBeInTheDocument();
  });

  it('populated without isEstimated renders normally without badge or CTA', () => {
    // makePopulated with no overrides omits isEstimated (older API response)
    const data = makePopulated();

    render(<ShoppingLine data={data} />);

    expect(screen.queryByTestId('estimated-badge')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /obter preços exatos/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Per-card failure indicator (variantFetchProgress.cards)
// ---------------------------------------------------------------------------

