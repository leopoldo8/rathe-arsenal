/**
 * ShoppingLine smoke tests — Plan C Unit 6.
 *
 * Covers:
 *  - Path A (data=null): "you have everything you need" renders.
 *  - Path B (populated, substituted): section heading + headline render.
 *  - Path C (populated, approximation — unscraped): renders null (no DOM).
 *  - Error state: onRetry callback is invoked; window.location.reload is NOT called.
 *  - Unscraped neutral fallback (R59): kind='unscraped' renders nothing.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShoppingLine } from '../ShoppingLine';
import type {
  IShoppingLinePopulated,
  IShoppingLineResponse,
} from '../../api/shopping-line';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW_MS = new Date('2026-04-27T12:00:00.000Z').getTime();

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const TWO_HOURS_AGO = new Date(NOW_MS - 2 * 60 * 60 * 1000).toISOString();

/** Path A exact match: all cards owned; shopping line is null. */
const PATH_A_DATA: null = null;

/** Path B substituted: populated with available cards (deck uses subs). */
const PATH_B_DATA: IShoppingLinePopulated = {
  kind: 'populated',
  storeName: 'Cupula DT',
  storeHostname: 'www.cupuladt.com.br',
  totalCostCents: 3990,
  availableCardCount: 2,
  unavailableCardCount: 0,
  lines: [
    {
      cardIdentifier: 'pummel',
      cardName: 'Pummel',
      quantityNeeded: 3,
      quantityAvailable: 3,
      unitPriceCents: 1330,
      productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=42',
      lastFetchedAt: TWO_HOURS_AGO,
    },
  ],
  lastFetchedAt: TWO_HOURS_AGO,
};

/** Unscraped: store not yet scraped — neutral fallback per R59. */
const PATH_UNSCRAPED_DATA: IShoppingLineResponse = { kind: 'unscraped' };

/** Error state: server-side computation failed. */
const ERROR_DATA: IShoppingLineResponse = { kind: 'error', reason: 'db_error' };

// ---------------------------------------------------------------------------
// Path A (exact match)
// ---------------------------------------------------------------------------

describe('ShoppingLine — Path A (data=null)', () => {
  it('renders the "you have everything you need" message', () => {
    render(<ShoppingLine data={PATH_A_DATA} />);
    expect(
      screen.getByText(/você tem tudo o que precisa para este baralho/i),
    ).toBeInTheDocument();
  });

  it('does not render a shopping section heading', () => {
    render(<ShoppingLine data={PATH_A_DATA} />);
    expect(
      screen.queryByRole('heading', { name: /lista de compras/i }),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Path B (substituted / populated)
// ---------------------------------------------------------------------------

describe('ShoppingLine — Path B (populated with available cards)', () => {
  it('renders the shopping line section heading', () => {
    render(<ShoppingLine data={PATH_B_DATA} />);
    expect(
      screen.getByRole('heading', { name: /lista de compras/i }),
    ).toBeInTheDocument();
  });

  it('renders the headline affordance with cost and store name', () => {
    render(<ShoppingLine data={PATH_B_DATA} />);
    expect(
      screen.getByText(/com r\$ 39,90 na cupula dt você fecha 2 de 2 cartas faltantes/i),
    ).toBeInTheDocument();
  });

  it('renders an "In stock" line group', () => {
    render(<ShoppingLine data={PATH_B_DATA} />);
    expect(screen.getByText(/em estoque \(1\)/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Path C approximation — unscraped neutral fallback (R59)
// ---------------------------------------------------------------------------

describe('ShoppingLine — kind=unscraped (neutral fallback, R59)', () => {
  it('renders nothing (returns null)', () => {
    const { container } = render(<ShoppingLine data={PATH_UNSCRAPED_DATA} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render a "shopping line" heading', () => {
    render(<ShoppingLine data={PATH_UNSCRAPED_DATA} />);
    expect(
      screen.queryByRole('heading', { name: /lista de compras/i }),
    ).not.toBeInTheDocument();
  });

  it('does not render the Path A "everything you need" message', () => {
    render(<ShoppingLine data={PATH_UNSCRAPED_DATA} />);
    expect(
      screen.queryByText(/você tem tudo/i),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Error state + onRetry contract
// ---------------------------------------------------------------------------

describe('ShoppingLine — error state', () => {
  it('renders the temporarily-unavailable message', () => {
    render(<ShoppingLine data={ERROR_DATA} />);
    expect(
      screen.getByText(/lista de compras temporariamente indisponível/i),
    ).toBeInTheDocument();
  });

  it('renders a Retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ShoppingLine data={ERROR_DATA} onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('does not render a Retry button when onRetry is absent', () => {
    render(<ShoppingLine data={ERROR_DATA} />);
    expect(screen.queryByRole('button', { name: /tentar novamente/i })).not.toBeInTheDocument();
  });

  it('calls onRetry when Retry is clicked', () => {
    const onRetry = vi.fn();
    render(<ShoppingLine data={ERROR_DATA} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does NOT call window.location.reload on retry click', () => {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    });

    const onRetry = vi.fn();
    render(<ShoppingLine data={ERROR_DATA} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(reloadSpy).not.toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
