import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShoppingLine } from '../ShoppingLine';
import {
  IShoppingLinePopulated,
  IShoppingLineLine,
  IShoppingLineVariant,
} from '../../api/shopping-line';

/**
 * Unit 7 test suite: variant breakdown display per card line.
 *
 * Tests cover all 8 required scenarios from the plan:
 *  1. Card with variant data shows cheapest variant price as primary (with
 *     condition annotation, foil annotation when applicable).
 *  2. "2 more variants" link expands to show full breakdown table.
 *  3. Single-variant card shows variant price directly, no expand link.
 *  4. Partially available card shows "1 of 3 copies available".
 *  5. Verified-unavailable card shows "Out of stock (verified)" and is
 *     visually distinct from "Unavailable" (never-checked).
 *  6. Failed-fetch card (no variant data, active fetch) does not break the UI;
 *     retains listing estimate gracefully.
 *  7. Variant breakdown table shows edition, condition, finish display label,
 *     price formatted as R$, and quantity per row.
 *  8. Backward-compat: lines with no variants field render exactly as before
 *     Unit 7 — no expand link, no annotation, tilde-prefix format when estimated.
 */

const NOW_MS = new Date('2026-04-12T12:00:00.000Z').getTime();
const TWO_HOURS_AGO = new Date(NOW_MS - 2 * 60 * 60 * 1000).toISOString();

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW_MS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeVariant(overrides: Partial<IShoppingLineVariant> = {}): IShoppingLineVariant {
  return {
    edition: 'Classic Battles - Rhinar vs Dorinthea',
    condition: 'NM',
    finish: 'Non-foil',
    priceCents: 35,
    quantity: 4,
    ...overrides,
  };
}

function makeLine(overrides: Partial<IShoppingLineLine> = {}): IShoppingLineLine {
  return {
    cardIdentifier: 'rhinar-brute-of-brokenbone',
    cardName: 'Rhinar, Brute of Brokenbone',
    quantityNeeded: 1,
    quantityAvailable: 1,
    unitPriceCents: 35,
    productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=1',
    lastFetchedAt: TWO_HOURS_AGO,
    hasVariantData: true,
    dataSource: 'variant',
    lineCostCents: 35,
    ...overrides,
  };
}

function makePopulated(
  linesOverride: readonly IShoppingLineLine[],
  additionalOverrides: Partial<Omit<IShoppingLinePopulated, 'lines'>> = {},
): IShoppingLinePopulated {
  const available = linesOverride.filter((l) => l.quantityAvailable > 0).length;
  const unavailable = linesOverride.filter((l) => l.quantityAvailable === 0).length;
  return {
    kind: 'populated',
    storeName: 'Cupula DT',
    storeHostname: 'www.cupuladt.com.br',
    totalCostCents: linesOverride.reduce((sum, l) => sum + (l.lineCostCents ?? 0), 0),
    availableCardCount: available,
    unavailableCardCount: unavailable,
    lines: linesOverride,
    lastFetchedAt: TWO_HOURS_AGO,
    isEstimated: false,
    ...additionalOverrides,
  };
}

// ---------------------------------------------------------------------------
// Scenario 1: Card with variant data shows cheapest variant price as primary
// ---------------------------------------------------------------------------

describe('Scenario 1: cheapest variant as primary price with condition annotation', () => {
  it('shows price with LP condition annotation when LP is the cheapest variant', () => {
    // Backend sends variants sorted ascending by price. LP (25¢) < NM (35¢).
    const variants = [
      makeVariant({ condition: 'LP', finish: 'Non-foil', priceCents: 25, quantity: 2 }),
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 4 }),
    ];
    const line = makeLine({ variants, unitPriceCents: 25 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByText(/r\$ 0,25 \(lp\)/i)).toBeInTheDocument();
  });

  it('shows price with NM condition annotation for NM cheapest variant', () => {
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 4 }),
    ];
    const line = makeLine({ variants, unitPriceCents: 35 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByText(/r\$ 0,35 \(nm\)/i)).toBeInTheDocument();
  });

  it('appends Foil annotation when cheapest variant is foil', () => {
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Rainbow Foil', priceCents: 80, quantity: 2 }),
    ];
    const line = makeLine({ variants, unitPriceCents: 80 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByText(/r\$ 0,80 \(nm, foil\)/i)).toBeInTheDocument();
  });

  it('does NOT append foil annotation for non-foil cheapest variant', () => {
    const variants = [
      makeVariant({ condition: 'MP', finish: 'Non-foil', priceCents: 20, quantity: 1 }),
    ];
    const line = makeLine({ variants, unitPriceCents: 20 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    // Should NOT have "Foil" in the text
    expect(screen.queryByText(/foil/i)).not.toBeInTheDocument();
    expect(screen.getByText(/r\$ 0,20 \(mp\)/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: "N more variants" link expands to show full breakdown table
// ---------------------------------------------------------------------------

describe('Scenario 2: expandable variant breakdown for multi-variant cards', () => {
  it('shows "2 more variants" toggle when card has 3 variants', async () => {
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 2 }),
      makeVariant({ condition: 'LP', finish: 'Non-foil', priceCents: 25, quantity: 1 }),
      makeVariant({ condition: 'MP', finish: 'Non-foil', priceCents: 20, quantity: 3 }),
    ];
    // Cheapest is MP at R$ 0,20
    const line = makeLine({ variants, unitPriceCents: 20 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByText(/2 more variant/i)).toBeInTheDocument();
  });

  it('shows "1 more variant" toggle when card has 2 variants', () => {
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 2 }),
      makeVariant({ condition: 'LP', finish: 'Non-foil', priceCents: 25, quantity: 1 }),
    ];
    const line = makeLine({ variants, unitPriceCents: 25 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByText(/1 more variant/i)).toBeInTheDocument();
  });

  it('expands breakdown table when toggle is activated', async () => {
    const user = userEvent.setup();
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 2 }),
      makeVariant({ condition: 'LP', finish: 'Non-foil', priceCents: 25, quantity: 1 }),
    ];
    const line = makeLine({ variants, unitPriceCents: 25 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    // Breakdown table should not be visible initially (details element is closed)
    const toggle = screen.getByText(/1 more variant/i);
    await user.click(toggle);

    // After expanding, table rows should be visible
    const rows = screen.getAllByRole('row');
    // Header row + 2 variant rows = 3
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it('is collapsed by default', () => {
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 2 }),
      makeVariant({ condition: 'LP', finish: 'Non-foil', priceCents: 25, quantity: 1 }),
    ];
    const line = makeLine({ variants, unitPriceCents: 25 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    // The <details> element should be closed by default
    const detailsEl = screen.getByTestId('variant-breakdown-details');
    expect(detailsEl).not.toHaveAttribute('open');
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Single-variant card — no expand link
// ---------------------------------------------------------------------------

describe('Scenario 3: single-variant card has no expand link', () => {
  it('shows variant price directly without an expand toggle', () => {
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 4 }),
    ];
    const line = makeLine({ variants, unitPriceCents: 35 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.queryByText(/more variant/i)).not.toBeInTheDocument();
    expect(screen.getByText(/r\$ 0,35 \(nm\)/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Partially available card
// ---------------------------------------------------------------------------

describe('Scenario 4: partially available card shows availability annotation', () => {
  it('shows "1 of 3 copies available" for a partially stocked line', () => {
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 1 }),
    ];
    const line = makeLine({
      variants,
      quantityNeeded: 3,
      quantityAvailable: 1,
      unitPriceCents: 35,
      lineCostCents: 35,
    });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByText(/1 of 3 copies available/i)).toBeInTheDocument();
  });

  it('shows correct copies text for 2 of 4 partial fill', () => {
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 2 }),
    ];
    const line = makeLine({
      variants,
      quantityNeeded: 4,
      quantityAvailable: 2,
      unitPriceCents: 35,
      lineCostCents: 70,
    });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByText(/2 of 4 copies available/i)).toBeInTheDocument();
  });

  it('does NOT show partial availability text when fully stocked', () => {
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 4 }),
    ];
    const line = makeLine({
      variants,
      quantityNeeded: 2,
      quantityAvailable: 2,
      unitPriceCents: 35,
    });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.queryByText(/copies available/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Verified unavailable vs. never-checked unavailable
// ---------------------------------------------------------------------------

describe('Scenario 5: verified-unavailable vs never-checked unavailable', () => {
  it('shows "Out of stock (verified)" for verified_zero cards', () => {
    const line = makeLine({
      quantityAvailable: 0,
      verificationStatus: 'verified_zero',
      hasVariantData: true,
    });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByText(/out of stock \(verified\)/i)).toBeInTheDocument();
  });

  it('shows "not in stock" (legacy) for never-checked unavailable cards', () => {
    const line = makeLine({
      quantityAvailable: 0,
      hasVariantData: false,
    });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByText(/not in stock/i)).toBeInTheDocument();
    expect(screen.queryByText(/verified/i)).not.toBeInTheDocument();
  });

  it('renders both states in the same list without mixing up labels', () => {
    const verifiedLine = makeLine({
      cardIdentifier: 'card-a',
      cardName: 'Card A',
      quantityAvailable: 0,
      verificationStatus: 'verified_zero',
      hasVariantData: true,
    });
    const neverCheckedLine = makeLine({
      cardIdentifier: 'card-b',
      cardName: 'Card B',
      quantityAvailable: 0,
      hasVariantData: false,
    });
    const data = makePopulated([verifiedLine, neverCheckedLine]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByText(/out of stock \(verified\)/i)).toBeInTheDocument();
    expect(screen.getByText(/not in stock/i)).toBeInTheDocument();
  });

  it('verified-unavailable card is rendered with muted styling (inside Unavailable group)', () => {
    const verifiedLine = makeLine({
      cardIdentifier: 'card-a',
      cardName: 'Verified Zero Card',
      quantityAvailable: 0,
      verificationStatus: 'verified_zero',
      hasVariantData: true,
    });
    const data = makePopulated([verifiedLine]);

    render(<ShoppingLine data={data} />);

    // Should appear in the Unavailable group, not in stock
    expect(screen.getByText(/unavailable \(1\)/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: Failed-fetch card retains listing estimate gracefully
// ---------------------------------------------------------------------------

describe('Scenario 6: failed-fetch card retains listing estimate without breaking', () => {
  it('renders a line without variant data during an active fetch without errors', () => {
    const lineWithoutVariantData = makeLine({
      hasVariantData: false,
      dataSource: 'listing',
      unitPriceCents: 4990,
    });
    const data = makePopulated([lineWithoutVariantData], {
      isEstimated: true,
      variantFetchProgress: {
        fetchId: 'active-fetch',
        total: 5,
        completed: 2,
        failed: 0,
        inProgress: true,
      },
    });

    render(<ShoppingLine data={data} onFetchVariants={vi.fn()} />);

    // Line should still be rendered, no crash
    expect(screen.getByText(/rhinar, brute of brokenbone/i)).toBeInTheDocument();
    // Should show tilde-prefixed estimate (not variant-annotated price)
    expect(screen.getByText(/~r\$ 49,90/i)).toBeInTheDocument();
  });

  it('does not render variant condition annotation for listing-only lines', () => {
    const listingLine = makeLine({
      hasVariantData: false,
      dataSource: 'listing',
      unitPriceCents: 4990,
    });
    const data = makePopulated([listingLine]);

    render(<ShoppingLine data={data} />);

    // Should NOT have a condition annotation like (NM)
    expect(screen.queryByText(/\(nm\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(lp\)/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: Variant breakdown table columns
// ---------------------------------------------------------------------------

describe('Scenario 7: variant breakdown table has correct columns', () => {
  it('shows edition, condition, finish display label, price, and quantity in each row', async () => {
    const user = userEvent.setup();
    const variants = [
      makeVariant({
        edition: 'WTR First Edition',
        condition: 'NM',
        finish: 'Non-foil',
        priceCents: 35,
        quantity: 4,
      }),
      makeVariant({
        edition: 'WTR Alpha Print',
        condition: 'LP',
        finish: 'Rainbow Foil',
        priceCents: 120,
        quantity: 1,
      }),
    ];
    const line = makeLine({ variants, unitPriceCents: 35 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    // Expand the details
    const toggle = screen.getByText(/1 more variant/i);
    await user.click(toggle);

    // Edition
    expect(screen.getByText(/WTR First Edition/i)).toBeInTheDocument();
    expect(screen.getByText(/WTR Alpha Print/i)).toBeInTheDocument();
    // Condition
    expect(screen.getAllByText(/^NM$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^LP$/i).length).toBeGreaterThan(0);
    // Finish display labels
    expect(screen.getByText(/non-foil/i)).toBeInTheDocument();
    // Foil finish shown with label (Rainbow Foil). Multiple elements may match /foil/
    // since the primary price annotation also contains "Foil".
    expect(screen.getAllByText(/foil/i).length).toBeGreaterThan(0);
    // Prices (primary price label and table cell may both show R$ 0,35)
    expect(screen.getAllByText(/r\$ 0,35/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/r\$ 1,20/i)).toBeInTheDocument();
    // Quantities
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders column headers: Edition, Condition, Finish, Price, Qty', async () => {
    const user = userEvent.setup();
    const variants = [
      makeVariant({ condition: 'NM', finish: 'Non-foil', priceCents: 35, quantity: 4 }),
      makeVariant({ condition: 'LP', finish: 'Non-foil', priceCents: 25, quantity: 1 }),
    ];
    const line = makeLine({ variants, unitPriceCents: 25 });
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    const toggle = screen.getByText(/1 more variant/i);
    await user.click(toggle);

    expect(screen.getByRole('columnheader', { name: /edition/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /condition/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /finish/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /price/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /qty/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scenario 8: Backward compatibility
// ---------------------------------------------------------------------------

describe('Scenario 8: backward compatibility - lines without variants field', () => {
  it('line with no variants field renders without expand link', () => {
    // Old response: no variants field, no hasVariantData
    const line: IShoppingLineLine = {
      cardIdentifier: 'old-card',
      cardName: 'Old Card',
      quantityNeeded: 1,
      quantityAvailable: 1,
      unitPriceCents: 4990,
      productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=99',
      lastFetchedAt: TWO_HOURS_AGO,
    };
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.queryByText(/more variant/i)).not.toBeInTheDocument();
    expect(screen.getByText('Old Card')).toBeInTheDocument();
  });

  it('line without hasVariantData renders tilde-prefix price when parent isEstimated is true', () => {
    const line: IShoppingLineLine = {
      cardIdentifier: 'old-card',
      cardName: 'Old Card',
      quantityNeeded: 1,
      quantityAvailable: 1,
      unitPriceCents: 4990,
      productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=99',
      lastFetchedAt: TWO_HOURS_AGO,
    };
    const data = makePopulated([line], { isEstimated: true });

    render(<ShoppingLine data={data} />);

    // No variant annotation; tilde-prefix rendering for estimated listing
    expect(screen.getByText(/~r\$ 49,90/i)).toBeInTheDocument();
    expect(screen.queryByText(/\(nm\)/i)).not.toBeInTheDocument();
  });

  it('null (Path A) still renders success empty state with no variant fields', () => {
    render(<ShoppingLine data={null} />);
    expect(screen.getByText(/you have everything you need for this deck/i)).toBeInTheDocument();
  });

  it('unscraped state still renders nothing', () => {
    const { container } = render(<ShoppingLine data={{ kind: 'unscraped' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('error state still renders degraded state message', () => {
    render(<ShoppingLine data={{ kind: 'error', reason: 'db_error' }} />);
    expect(screen.getByText(/shopping line temporarily unavailable/i)).toBeInTheDocument();
  });

  it('populated state without variant fields renders headline and card list normally', () => {
    const line: IShoppingLineLine = {
      cardIdentifier: 'old-card',
      cardName: 'Old Card',
      quantityNeeded: 1,
      quantityAvailable: 1,
      unitPriceCents: 4990,
      productUrl: 'https://www.cupuladt.com.br/?view=ecom/item&id=99',
      lastFetchedAt: TWO_HOURS_AGO,
    };
    const data = makePopulated([line]);

    render(<ShoppingLine data={data} />);

    expect(screen.getByRole('heading', { name: /shopping line/i })).toBeInTheDocument();
    expect(screen.getByText('Old Card')).toBeInTheDocument();
  });
});
