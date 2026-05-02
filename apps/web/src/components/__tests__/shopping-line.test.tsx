import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShoppingLine } from '../ShoppingLine';
import { validateProductUrl } from '../StoreProductLink.helpers';
import {
  IShoppingLinePopulated,
  IShoppingLineResponse,
} from '../../api/shopping-line';

/**
 * Unit tests for <ShoppingLine /> covering the 6 UI states (D9) and
 * the <StoreProductLink /> validation guard (S10).
 *
 * Also contains grep-style regression checks for XSS and placeholder removal (S11).
 */

const NOW_MS = new Date('2026-04-12T12:00:00.000Z').getTime();

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TWO_HOURS_AGO = new Date(NOW_MS - 2 * 60 * 60 * 1000).toISOString();

const BASE_LINE = {
  cardIdentifier: 'rhinar-brute-of-brokenbone',
  cardName: 'Rhinar, Brute of Brokenbone',
  quantityNeeded: 1,
  quantityAvailable: 1,
  unitPriceCents: 4990,
  productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=1',
  lastFetchedAt: TWO_HOURS_AGO,
} as const;

const UNAVAILABLE_LINE = {
  cardIdentifier: 'pummel',
  cardName: 'Pummel',
  quantityNeeded: 3,
  quantityAvailable: 0,
  unitPriceCents: null,
  productUrl: '',
  lastFetchedAt: TWO_HOURS_AGO,
} as const;

const POPULATED_PARTIAL: IShoppingLinePopulated = {
  kind: 'populated',
  storeName: 'Cupula DT',
  storeHostname: 'www.cupuladt.com.br',
  totalCostCents: 4990,
  availableCardCount: 1,
  unavailableCardCount: 1,
  lines: [BASE_LINE, UNAVAILABLE_LINE],
  lastFetchedAt: TWO_HOURS_AGO,
};

const POPULATED_FULL: IShoppingLinePopulated = {
  kind: 'populated',
  storeName: 'Cupula DT',
  storeHostname: 'www.cupuladt.com.br',
  totalCostCents: 4990,
  availableCardCount: 1,
  unavailableCardCount: 0,
  lines: [BASE_LINE],
  lastFetchedAt: TWO_HOURS_AGO,
};

const POPULATED_NO_STOCK: IShoppingLinePopulated = {
  kind: 'populated',
  storeName: 'Cupula DT',
  storeHostname: 'www.cupuladt.com.br',
  totalCostCents: 0,
  availableCardCount: 0,
  unavailableCardCount: 2,
  lines: [
    { ...BASE_LINE, quantityAvailable: 0, productUrl: '' },
    UNAVAILABLE_LINE,
  ],
  lastFetchedAt: TWO_HOURS_AGO,
};

// ---------------------------------------------------------------------------
// State 1: null (Path A)
// ---------------------------------------------------------------------------

describe('ShoppingLine: null (Path A)', () => {
  it('renders the "you have everything you need" message', () => {
    render(<ShoppingLine data={null} />);
    expect(
      screen.getByText(/you have everything you need for this deck/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// State 2: unscraped
// ---------------------------------------------------------------------------

describe('ShoppingLine: kind=unscraped', () => {
  it('renders nothing', () => {
    const data: IShoppingLineResponse = { kind: 'unscraped' };
    const { container } = render(<ShoppingLine data={data} />);
    expect(container).toBeEmptyDOMElement();
  });
});

// ---------------------------------------------------------------------------
// State 3: error
// ---------------------------------------------------------------------------

describe('ShoppingLine: kind=error', () => {
  it('renders the temporarily-unavailable message', () => {
    const data: IShoppingLineResponse = { kind: 'error', reason: 'db_error' };
    render(<ShoppingLine data={data} />);
    expect(
      screen.getByText(/shopping line temporarily unavailable/i),
    ).toBeInTheDocument();
  });

  it('does not render "you have everything you need" for an error', () => {
    const data: IShoppingLineResponse = { kind: 'error', reason: 'db_error' };
    render(<ShoppingLine data={data} />);
    expect(
      screen.queryByText(/you have everything you need/i),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// State 4: no-stock
// ---------------------------------------------------------------------------

describe('ShoppingLine: kind=populated, availableCardCount=0', () => {
  it('renders the no-stock message', () => {
    render(<ShoppingLine data={POPULATED_NO_STOCK} />);
    expect(
      screen.getByText(/no missing cards currently in stock/i),
    ).toBeInTheDocument();
  });

  it('renders the freshness subtitle', () => {
    render(<ShoppingLine data={POPULATED_NO_STOCK} />);
    expect(screen.getByText(/last checked 2h ago/i)).toBeInTheDocument();
  });

  it('renders the substitution editor CTA', () => {
    render(<ShoppingLine data={POPULATED_NO_STOCK} />);
    expect(
      screen.getByText(/try the substitution editor/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// State 5 & 6: populated
// ---------------------------------------------------------------------------

describe('ShoppingLine: kind=populated, partial availability', () => {
  it('renders the section heading', () => {
    render(<ShoppingLine data={POPULATED_PARTIAL} />);
    expect(screen.getByRole('heading', { name: /shopping line/i })).toBeInTheDocument();
  });

  it('renders the headline affordance with correct amounts', () => {
    render(<ShoppingLine data={POPULATED_PARTIAL} />);
    expect(screen.getByText(/with r\$ 49,90 at cupula dt you close 1 of 2 missing cards/i)).toBeInTheDocument();
  });

  it('renders the "In stock" sub-group header', () => {
    render(<ShoppingLine data={POPULATED_PARTIAL} />);
    expect(screen.getByText(/in stock \(1\)/i)).toBeInTheDocument();
  });

  it('renders the "Unavailable" sub-group header', () => {
    render(<ShoppingLine data={POPULATED_PARTIAL} />);
    expect(screen.getByText(/unavailable \(1\)/i)).toBeInTheDocument();
  });

  it('renders a View link for the available card', () => {
    render(<ShoppingLine data={POPULATED_PARTIAL} />);
    const link = screen.getByRole('link', { name: /open rhinar.*cupula dt.*new tab/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders the freshness timestamp', () => {
    render(<ShoppingLine data={POPULATED_PARTIAL} />);
    expect(screen.getByText(/updated 2h ago/i)).toBeInTheDocument();
  });
});

describe('ShoppingLine: kind=populated, all available', () => {
  it('renders the headline showing N of N cards', () => {
    render(<ShoppingLine data={POPULATED_FULL} />);
    expect(screen.getByText(/with r\$ 49,90 at cupula dt you close 1 of 1 missing card/i)).toBeInTheDocument();
  });

  it('does not render an Unavailable sub-group', () => {
    render(<ShoppingLine data={POPULATED_FULL} />);
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// StoreProductLink URL validation (S10)
// ---------------------------------------------------------------------------

describe('validateProductUrl', () => {
  const HOSTNAME = 'www.cupuladt.com.br';

  it('accepts a valid https URL matching the expected hostname', () => {
    expect(
      validateProductUrl('https://www.cupuladt.com.br/?view=ecom/item&id=1', HOSTNAME),
    ).toBe(true);
  });

  it('rejects a URL with a mismatched hostname', () => {
    expect(
      validateProductUrl('https://www.evil.com/path', HOSTNAME),
    ).toBe(false);
  });

  it('rejects a javascript: URL', () => {
    expect(validateProductUrl('javascript:alert(1)', HOSTNAME)).toBe(false);
  });

  it('rejects a data: URL', () => {
    expect(
      validateProductUrl('data:text/html,<script>alert(1)</script>', HOSTNAME),
    ).toBe(false);
  });

  it('rejects an http: URL even with matching hostname', () => {
    expect(
      validateProductUrl('http://www.cupuladt.com.br/item', HOSTNAME),
    ).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(validateProductUrl('', HOSTNAME)).toBe(false);
  });

  it('rejects a malformed string', () => {
    expect(validateProductUrl('not a url', HOSTNAME)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regression: Phase 1a placeholder removed
// ---------------------------------------------------------------------------

describe('Regression: placeholder copy is absent', () => {
  it('does not render the Phase 1a placeholder text in any state', () => {
    const states: Array<IShoppingLineResponse | null> = [
      null,
      { kind: 'unscraped' },
      { kind: 'error', reason: 'db_error' },
      POPULATED_PARTIAL,
      POPULATED_FULL,
      POPULATED_NO_STOCK,
    ];

    for (const data of states) {
      const { unmount } = render(<ShoppingLine data={data} />);
      expect(
        screen.queryByText(/check availability at.*coming in phase 1b/i),
      ).not.toBeInTheDocument();
      unmount();
    }
  });
});
