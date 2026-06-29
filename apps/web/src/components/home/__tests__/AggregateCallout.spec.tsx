import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AggregateCallout } from '../AggregateCallout';
import { ITrackedDeckListResponse } from '../../../api/decks';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type TAgg = ITrackedDeckListResponse['aggregateShoppingLine'];

const POPULATED_AGG: NonNullable<TAgg> = {
  storeName: 'Cupula DT',
  storeSlug: 'cupula-dt',
  totalCostCents: 31200,
  completableDecks: 4,
  totalDecks: 6,
  kind: 'populated',
  uniqueCardsMissing: 12,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AggregateCallout', () => {
  it('renders the callout when data is valid and populated', () => {
    render(<AggregateCallout aggregateShoppingLine={POPULATED_AGG} />);
    // Callout should show cost, completable count, and store name
    expect(screen.getByText(/Cupula DT/)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/6/)).toBeInTheDocument();
  });

  it('renders null when aggregateShoppingLine is null', () => {
    const { container } = render(<AggregateCallout aggregateShoppingLine={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders null when kind is "unscraped"', () => {
    const { container } = render(
      <AggregateCallout
        aggregateShoppingLine={{ ...POPULATED_AGG, kind: 'unscraped' }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null when totalCostCents is 0', () => {
    const { container } = render(
      <AggregateCallout
        aggregateShoppingLine={{ ...POPULATED_AGG, totalCostCents: 0 }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null when completableDecks is 0', () => {
    const { container } = render(
      <AggregateCallout
        aggregateShoppingLine={{ ...POPULATED_AGG, completableDecks: 0 }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('has aria-label "Aggregate shopping line"', () => {
    render(<AggregateCallout aggregateShoppingLine={POPULATED_AGG} />);
    expect(
      screen.getByRole('complementary', { name: /resumo de compra/i }),
    ).toBeInTheDocument();
  });

  it('shows the formatted BRL cost', () => {
    render(<AggregateCallout aggregateShoppingLine={{ ...POPULATED_AGG, totalCostCents: 31200 }} />);
    // formatBrl(31200) = "R$ 312,00"
    expect(screen.getByText(/R\$ 312/)).toBeInTheDocument();
  });
});
