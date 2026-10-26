import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { IShoppingLinePopulated } from '../../../api/shopping-line';
import { MissingStoreSummary } from '../MissingStoreSummary';

function populated(overrides: Partial<IShoppingLinePopulated> = {}): IShoppingLinePopulated {
  return {
    kind: 'populated',
    storeName: 'Cupula DT',
    storeHostname: 'www.cupuladt.com.br',
    totalCostCents: 9980,
    availableCardCount: 2,
    unavailableCardCount: 1,
    lines: [],
    lastFetchedAt: new Date().toISOString(),
    isEstimated: true,
    ...overrides,
  };
}

describe('MissingStoreSummary', () => {
  it('explains the estimated price in visible text, with no native tooltip', () => {
    const { container } = render(<MissingStoreSummary data={populated()} />);

    expect(screen.getByTestId('missing-store-estimate-note')).toHaveTextContent('Preço estimado pelo anúncio da loja.');
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('says nothing about an estimate when the price is exact', () => {
    render(<MissingStoreSummary data={populated({ isEstimated: false })} />);

    expect(screen.queryByTestId('missing-store-estimate-note')).toBeNull();
  });
});
