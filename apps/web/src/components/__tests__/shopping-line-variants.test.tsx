import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShoppingLine } from '../ShoppingLine';
import { computeVariantFetchInterval, VARIANT_FETCH_POLL_TIMEOUT_MS } from '../../api/deck-detail';
import {
  IShoppingLinePopulated,
  IVariantFetchProgress,
} from '../../api/shopping-line';
import type { IDeckDetailResponse } from '../../api/deck-detail';

/**
 * Unit 6 test suite: estimated badge, CTA, polling, and progress indicator.
 *
 * Tests cover all 9 required scenarios from the plan:
 *  1. CTA renders when isEstimated === true
 *  2. Clicking CTA triggers mutation and shows progress indicator
 *  3. Estimated badge appears with listing-only data, disappears after all
 *     cards have variants
 *  4. CTA disabled during cooldown with "last checked" text
 *  5. Progress shows "Checking card 3 of 12..." during fetch
 *  6. Partial failure shows "8 of 12 updated" with retry button
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

// ---------------------------------------------------------------------------
// Scenario 1: CTA renders when isEstimated === true
// ---------------------------------------------------------------------------

describe('Scenario 1: CTA renders when isEstimated is true', () => {
  it('renders "Get exact prices" button when isEstimated is true and callback provided', () => {
    const data = makePopulated({ isEstimated: true });
    const onFetchVariants = vi.fn();

    render(<ShoppingLine data={data} onFetchVariants={onFetchVariants} />);

    expect(screen.getByRole('button', { name: /get exact prices/i })).toBeInTheDocument();
  });

  it('does not render "Get exact prices" CTA when isEstimated is false', () => {
    const data = makePopulated({ isEstimated: false });
    const onFetchVariants = vi.fn();

    render(<ShoppingLine data={data} onFetchVariants={onFetchVariants} />);

    expect(screen.queryByRole('button', { name: /get exact prices/i })).not.toBeInTheDocument();
  });

  it('does not render CTA when onFetchVariants callback is not provided', () => {
    const data = makePopulated({ isEstimated: true });

    render(<ShoppingLine data={data} />);

    expect(screen.queryByRole('button', { name: /get exact prices/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Clicking CTA triggers mutation and shows progress indicator
// ---------------------------------------------------------------------------

describe('Scenario 2: clicking CTA triggers mutation and shows progress', () => {
  it('calls onFetchVariants when the CTA button is clicked', () => {
    const data = makePopulated({ isEstimated: true });
    const onFetchVariants = vi.fn();

    render(<ShoppingLine data={data} onFetchVariants={onFetchVariants} />);
    fireEvent.click(screen.getByRole('button', { name: /get exact prices/i }));

    expect(onFetchVariants).toHaveBeenCalledOnce();
  });

  it('shows progress indicator when variantFetchProgress.inProgress is true', () => {
    const progress = makeProgress({ inProgress: true, completed: 0, total: 12 });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    // CTA should be replaced by progress indicator
    expect(screen.queryByRole('button', { name: /get exact prices/i })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText(/checking card/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Estimated badge appears and disappears
// ---------------------------------------------------------------------------

describe('Scenario 3: estimated badge lifecycle', () => {
  it('renders the "estimated" badge when isEstimated is true', () => {
    const data = makePopulated({ isEstimated: true });

    render(<ShoppingLine data={data} />);

    expect(screen.getByTestId('estimated-badge')).toBeInTheDocument();
    expect(screen.getByTestId('estimated-badge')).toHaveTextContent('estimated');
  });

  it('renders a tilde prefix on the price when isEstimated is true', () => {
    const data = makePopulated({ isEstimated: true });

    render(<ShoppingLine data={data} />);

    // The tilde is in a separate span with aria-label="estimated price"
    expect(screen.getByLabelText(/estimated price/i)).toHaveTextContent('~');
  });

  it('does not render the "estimated" badge when isEstimated is false', () => {
    const data = makePopulated({ isEstimated: false });

    render(<ShoppingLine data={data} />);

    expect(screen.queryByTestId('estimated-badge')).not.toBeInTheDocument();
  });

  it('does not render the tilde when isEstimated is false', () => {
    const data = makePopulated({ isEstimated: false });

    render(<ShoppingLine data={data} />);

    expect(screen.queryByLabelText(/estimated price/i)).not.toBeInTheDocument();
  });

  it('does not render the estimated badge when isEstimated is absent (older responses)', () => {
    // makePopulated without isEstimated override omits the field entirely
    const data = makePopulated();

    render(<ShoppingLine data={data} />);

    expect(screen.queryByTestId('estimated-badge')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: CTA disabled during cooldown
// ---------------------------------------------------------------------------

describe('Scenario 4: cooldown state replaces CTA with "up to date" message', () => {
  it('shows "up to date" message when isCooldownActive is true', () => {
    const data = makePopulated({ isEstimated: true });

    render(
      <ShoppingLine
        data={data}
        onFetchVariants={vi.fn()}
        isCooldownActive={true}
      />,
    );

    expect(screen.queryByRole('button', { name: /get exact prices/i })).not.toBeInTheDocument();
    expect(screen.getByText(/prices are up to date/i)).toBeInTheDocument();
  });

  it('renders CTA button when isCooldownActive is false', () => {
    const data = makePopulated({ isEstimated: true });

    render(
      <ShoppingLine
        data={data}
        onFetchVariants={vi.fn()}
        isCooldownActive={false}
      />,
    );

    expect(screen.getByRole('button', { name: /get exact prices/i })).toBeInTheDocument();
  });

  it('button is disabled and shows "Starting..." when fetchMutationStatus is pending', () => {
    const data = makePopulated({ isEstimated: true });

    render(
      <ShoppingLine
        data={data}
        onFetchVariants={vi.fn()}
        fetchMutationStatus="pending"
      />,
    );

    const btn = screen.getByRole('button', { name: /starting/i });
    expect(btn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Progress shows "Checking card 3 of 12..."
// ---------------------------------------------------------------------------

describe('Scenario 5: progress indicator text', () => {
  it('shows "Checking card 1 of 12..." when no cards have been processed yet', () => {
    const progress = makeProgress({ completed: 0, failed: 0, total: 12, inProgress: true });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.getByText(/checking card 1 of 12/i)).toBeInTheDocument();
  });

  it('shows "Checking card 3 of 12..." when 2 cards have been processed', () => {
    const progress = makeProgress({ completed: 2, failed: 0, total: 12, inProgress: true });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.getByText(/checking card 3 of 12/i)).toBeInTheDocument();
  });

  it('shows "Checking card 12 of 12..." when 11 cards have been processed', () => {
    const progress = makeProgress({ completed: 10, failed: 1, total: 12, inProgress: true });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.getByText(/checking card 12 of 12/i)).toBeInTheDocument();
  });

  it('does not exceed total in the progress label', () => {
    // Edge: all 12 processed, but inProgress is still true momentarily
    const progress = makeProgress({ completed: 12, failed: 0, total: 12, inProgress: true });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.getByText(/checking card 12 of 12/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: Partial failure shows "8 of 12 updated" with retry button
// ---------------------------------------------------------------------------

describe('Scenario 6: partial failure notice', () => {
  it('shows partial failure notice when inProgress is false and failed > 0', () => {
    const progress = makeProgress({
      completed: 8,
      failed: 4,
      total: 12,
      inProgress: false,
    });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.getByText(/8 of 12 updated/i)).toBeInTheDocument();
    expect(screen.getByText(/4 failed/i)).toBeInTheDocument();
  });

  it('renders "Retry failed" button in the partial failure notice', () => {
    const progress = makeProgress({
      completed: 8,
      failed: 4,
      total: 12,
      inProgress: false,
    });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.getByRole('button', { name: /retry failed/i })).toBeInTheDocument();
  });

  it('calls onFetchVariants when "Retry failed" button is clicked', () => {
    const progress = makeProgress({
      completed: 8,
      failed: 4,
      total: 12,
      inProgress: false,
    });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });
    const onFetchVariants = vi.fn();

    render(<ShoppingLine data={data} onFetchVariants={onFetchVariants} />);
    fireEvent.click(screen.getByRole('button', { name: /retry failed/i }));

    expect(onFetchVariants).toHaveBeenCalledOnce();
  });

  it('does not show partial failure notice when failed === 0', () => {
    const progress = makeProgress({
      completed: 12,
      failed: 0,
      total: 12,
      inProgress: false,
    });
    const data = makePopulated({ isEstimated: false, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.queryByText(/retry failed/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenarios 7, 8, 9: computeVariantFetchInterval unit tests (polling logic)
//
// These test the pure function directly to verify the 4 stop conditions
// without needing to mount a full component or simulate real time passage.
// ---------------------------------------------------------------------------

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
      legality: { category: 'legal', reasons: [] },
      totalCards: 40,
      latestSnapshot: null,
      rejectedCount: 0,
      approvedCount: 0,
      pendingCount: 0,
      decisions: [],
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
      legality: { category: 'legal', reasons: [] },
      totalCards: 40,
      latestSnapshot: null,
      rejectedCount: 0,
      approvedCount: 0,
      pendingCount: 0,
      decisions: [],
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
      legality: { category: 'legal', reasons: [] },
      totalCards: 40,
      latestSnapshot: null,
      rejectedCount: 0,
      approvedCount: 0,
      pendingCount: 0,
      decisions: [],
      shoppingLine: { kind: 'unscraped' },
    };

    const result = computeVariantFetchInterval(data, NOW_MS);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// onPollingChange callback integration tests
// ---------------------------------------------------------------------------

describe('onPollingChange callback', () => {
  it('calls onPollingChange with a timestamp when fetch becomes active', () => {
    const progress = makeProgress({ inProgress: true });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });
    const onPollingChange = vi.fn();

    render(
      <ShoppingLine
        data={data}
        onFetchVariants={vi.fn()}
        onPollingChange={onPollingChange}
      />,
    );

    expect(onPollingChange).toHaveBeenCalledWith(expect.any(Number));
  });

  it('calls onPollingChange with undefined when variantFetchProgress is absent', () => {
    // makePopulated with isEstimated: true but no variantFetchProgress
    const data = makePopulated({ isEstimated: true });
    const onPollingChange = vi.fn();

    render(
      <ShoppingLine
        data={data}
        onFetchVariants={vi.fn()}
        onPollingChange={onPollingChange}
      />,
    );

    expect(onPollingChange).toHaveBeenCalledWith(undefined);
  });

  it('calls onPollingChange with undefined when inProgress is false', () => {
    const progress = makeProgress({ inProgress: false });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });
    const onPollingChange = vi.fn();

    render(
      <ShoppingLine
        data={data}
        onFetchVariants={vi.fn()}
        onPollingChange={onPollingChange}
      />,
    );

    expect(onPollingChange).toHaveBeenCalledWith(undefined);
  });

  it('calls onPollingChange with undefined after the 5-minute safety timeout fires', () => {
    const progress = makeProgress({ inProgress: true });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });
    const onPollingChange = vi.fn();

    render(
      <ShoppingLine
        data={data}
        onFetchVariants={vi.fn()}
        onPollingChange={onPollingChange}
      />,
    );

    // Advance fake timers past the 5-minute timeout
    act(() => {
      vi.advanceTimersByTime(VARIANT_FETCH_POLL_TIMEOUT_MS + 1_000);
    });

    // After the timeout, polling stopped, so onPollingChange is called with undefined
    expect(onPollingChange).toHaveBeenCalledWith(undefined);
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility: existing states still render correctly
// ---------------------------------------------------------------------------

describe('backward compatibility: existing 6 states unaffected', () => {
  it('null (Path A) still renders success empty state', () => {
    render(<ShoppingLine data={null} />);
    expect(screen.getByText(/you have everything you need for this deck/i)).toBeInTheDocument();
  });

  it('unscraped still renders nothing', () => {
    const { container } = render(<ShoppingLine data={{ kind: 'unscraped' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('error still renders degraded state', () => {
    render(<ShoppingLine data={{ kind: 'error', reason: 'db_error' }} />);
    expect(screen.getByText(/shopping line temporarily unavailable/i)).toBeInTheDocument();
  });

  it('populated without isEstimated renders normally without badge or CTA', () => {
    // makePopulated with no overrides omits isEstimated (older API response)
    const data = makePopulated();

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.queryByTestId('estimated-badge')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /get exact prices/i })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Per-card failure indicator (variantFetchProgress.cards)
// ---------------------------------------------------------------------------

describe('per-card failure indicator', () => {
  it('renders a "failed" badge next to a card whose fetch status is failed', () => {
    const progress = makeProgress({
      inProgress: false,
      completed: 1,
      failed: 1,
      total: 2,
      cards: {
        [BASE_LINE.cardIdentifier]: 'failed',
        [SECOND_LINE.cardIdentifier]: 'done',
      },
    });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    const badges = screen.getAllByTestId('line-item-fetch-failed');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent(/failed/i);
    expect(badges[0]).toHaveAttribute(
      'aria-label',
      `Failed to fetch variants for ${BASE_LINE.cardName}`,
    );
  });

  it('does not render the "failed" badge for cards with done or pending status', () => {
    const progress = makeProgress({
      inProgress: true,
      completed: 1,
      failed: 0,
      total: 2,
      cards: {
        [BASE_LINE.cardIdentifier]: 'done',
        [SECOND_LINE.cardIdentifier]: 'pending',
      },
    });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.queryByTestId('line-item-fetch-failed')).not.toBeInTheDocument();
  });

  it('does not render any "failed" badge when variantFetchProgress is absent', () => {
    const data = makePopulated({ isEstimated: true });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.queryByTestId('line-item-fetch-failed')).not.toBeInTheDocument();
  });

  it('does not render the badge when cards map is absent (older API response)', () => {
    const progress = makeProgress({
      inProgress: false,
      completed: 2,
      failed: 0,
      total: 2,
    });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    expect(screen.queryByTestId('line-item-fetch-failed')).not.toBeInTheDocument();
  });

  it('renders the badge on unavailable lines too, not just in-stock ones', () => {
    const progress = makeProgress({
      inProgress: false,
      completed: 0,
      failed: 2,
      total: 2,
      cards: {
        [BASE_LINE.cardIdentifier]: 'failed',
        [SECOND_LINE.cardIdentifier]: 'failed',
      },
    });
    const data = makePopulated({ isEstimated: true, variantFetchProgress: progress });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    const badges = screen.getAllByTestId('line-item-fetch-failed');
    expect(badges).toHaveLength(2);
  });
});
