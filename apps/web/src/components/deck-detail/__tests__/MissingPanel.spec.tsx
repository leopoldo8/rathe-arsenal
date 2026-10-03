import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import type { IShoppingLineLine, IShoppingLinePopulated } from '../../../api/shopping-line';
import { entry } from './deckDetailTestData';
import { MissingPanel } from '../MissingPanel';
import markOwnedStyles from '../MarkOwnedButton.module.css';

const HOST = 'www.cupuladt.com.br';
const NOW = Date.now();
const FRESH = new Date(NOW - 60_000).toISOString();
const OLD = new Date(NOW - 9 * 86_400_000).toISOString();

function line(overrides: Partial<IShoppingLineLine>): IShoppingLineLine {
  return {
    cardIdentifier: 'card-a',
    cardName: 'Card A',
    quantityNeeded: 3,
    quantityAvailable: 3,
    unitPriceCents: 790,
    productUrl: `https://${HOST}/?id=1`,
    lastFetchedAt: FRESH,
    ...overrides,
  };
}

function populated(overrides: Partial<IShoppingLinePopulated> = {}): IShoppingLinePopulated {
  return {
    kind: 'populated',
    storeName: 'Cúpula DT',
    storeHostname: HOST,
    totalCostCents: 2370,
    availableCardCount: 1,
    unavailableCardCount: 1,
    lastFetchedAt: FRESH,
    lines: [line({})],
    ...overrides,
  };
}

const ENTRIES = [
  entry({ cardIdentifier: 'card-a', name: 'Card A', quantity: 3 }),
  entry({ cardIdentifier: 'card-b', name: 'Card B', quantity: 2 }),
];

function renderPanel(
  shoppingData: Parameters<typeof MissingPanel>[0]['shoppingData'],
  extra: Partial<Parameters<typeof MissingPanel>[0]> = {},
): void {
  render(
    <MissingPanel
      entries={ENTRIES}
      shoppingData={shoppingData}
      onMarkOwned={vi.fn()}
      isMarkingOwned={false}
      pendingCard={null}
      onFetchVariants={vi.fn()}
      fetchMutationStatus="idle"
      isCooldownActive={false}
      onPollingChange={vi.fn()}
      onShoppingRetry={vi.fn()}
      {...extra}
    />,
  );
}

const rowOf = (name: string): HTMLElement =>
  screen.getAllByTestId('missing-row').find((row) => row.textContent?.includes(name))!;

describe('MissingPanel — one merged panel', () => {
  it('renders a single panel and no separate shopping-line block', () => {
    renderPanel(populated());

    expect(screen.getAllByTestId('deck-missing-panel')).toHaveLength(1);
    expect(screen.queryByLabelText(/linha de compras|shopping line/i)).toBeNull();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(screen.getByTestId('missing-store-summary')).toBeInTheDocument();
  });

  it('shows the store total in the header summary', () => {
    renderPanel(populated());

    expect(screen.getByTestId('missing-store-summary')).toHaveTextContent('R$ 23,70');
    expect(screen.getByTestId('missing-store-summary')).toHaveTextContent('1 de 2');
  });

  it('shows no store summary when the store was never scraped', () => {
    renderPanel({ kind: 'unscraped' });

    expect(screen.queryByTestId('missing-store-summary')).toBeNull();
    expect(within(rowOf('Card A')).queryByRole('link')).toBeNull();
    expect(within(rowOf('Card A')).queryByTestId('missing-row-unavailable')).toBeNull();
  });
});

describe('MissingPanel — store states per row', () => {
  it('in stock: shows the price and a Buy link to the store product page', () => {
    renderPanel(populated());

    const row = rowOf('Card A');
    expect(within(row).getByTestId('missing-row-price')).toHaveTextContent('~R$ 7,90');
    const link = within(row).getByRole('link');
    expect(link).toHaveAttribute('href', `https://${HOST}/?id=1`);
    expect(link).toHaveTextContent('Comprar');
  });

  it('not carried by the store: explicit unavailable text and no buy control', () => {
    renderPanel(populated());

    const row = rowOf('Card B');
    expect(within(row).getByTestId('missing-row-unavailable')).toHaveTextContent('Indisponível na Cúpula DT');
    expect(within(row).queryByRole('link')).toBeNull();
  });

  it('listed with zero stock: unavailable, even when the line still carries a url', () => {
    renderPanel(
      populated({
        lines: [
          line({}),
          line({ cardIdentifier: 'card-b', quantityAvailable: 0, productUrl: `https://${HOST}/?id=2` }),
        ],
      }),
    );

    expect(within(rowOf('Card B')).getByTestId('missing-row-unavailable')).toBeInTheDocument();
    expect(within(rowOf('Card B')).queryByRole('link')).toBeNull();
  });

  it('verified zero stock says so', () => {
    renderPanel(
      populated({
        lines: [line({ cardIdentifier: 'card-b', quantityAvailable: 0, verificationStatus: 'verified_zero' })],
      }),
    );

    expect(within(rowOf('Card B')).getByTestId('missing-row-unavailable')).toHaveTextContent('Sem estoque na Cúpula DT (verificado)');
  });

  it('never renders a Buy link with an empty or foreign url (it would point at the deck page)', () => {
    renderPanel(
      populated({
        lines: [
          line({ productUrl: '' }),
          line({ cardIdentifier: 'card-b', productUrl: 'https://evil.example/x' }),
        ],
      }),
    );

    expect(screen.queryByRole('link')).toBeNull();
    expect(within(rowOf('Card A')).getByTestId('missing-row-price')).toBeInTheDocument();
  });

  it('partial stock shows the available count', () => {
    renderPanel(populated({ lines: [line({ quantityAvailable: 1 })] }));

    expect(within(rowOf('Card A')).getByText('1 de 3 disponíveis')).toBeInTheDocument();
  });

  it('uses the cheapest variant price and keeps the variant breakdown', () => {
    const variants = [
      { edition: 'Welcome', condition: 'NM', finish: 'Non-foil', priceCents: 500, quantity: 2 },
      { edition: 'Welcome', condition: 'LP', finish: 'Rainbow Foil', priceCents: 900, quantity: 1 },
    ];
    renderPanel(populated({ lines: [line({ hasVariantData: true, variants })] }));

    expect(within(rowOf('Card A')).getByTestId('missing-row-price')).toHaveTextContent('R$ 5,00 (NM)');
    expect(within(rowOf('Card A')).getByTestId('variant-breakdown-details')).toBeInTheDocument();
  });

  it('flags a card whose exact-price fetch failed', () => {
    renderPanel(
      populated({
        variantFetchProgress: {
          fetchId: 'f', total: 1, completed: 0, failed: 1, inProgress: false,
          cards: { 'card-a': 'failed' },
        },
      }),
    );

    expect(within(rowOf('Card A')).getByTestId('line-item-fetch-failed')).toBeInTheDocument();
  });
});

describe('MissingPanel — preserved store behaviors', () => {
  it('"Obter preços exatos" calls the fetch handler when estimated', () => {
    const onFetchVariants = vi.fn();
    renderPanel(populated({ isEstimated: true }), { onFetchVariants });

    fireEvent.click(screen.getByRole('button', { name: 'Obter preços exatos' }));
    expect(onFetchVariants).toHaveBeenCalledTimes(1);
  });

  it('shows the up-to-date message instead of the button during cooldown', () => {
    renderPanel(populated({ isEstimated: true }), { isCooldownActive: true });

    expect(screen.queryByRole('button', { name: 'Obter preços exatos' })).toBeNull();
  });

  it('warns about stale prices in the pt-BR UI without English leaking', () => {
    renderPanel(populated({ lastFetchedAt: OLD }));

    const summary = screen.getByTestId('missing-store-summary');
    expect(screen.getByTestId('missing-store-stale')).toBeInTheDocument();
    expect(summary).toHaveTextContent('atualizado há mais de uma semana');
    expect(summary.textContent).not.toMatch(/ago|over a week/i);
  });

  it('reports polling to the host while a fetch is in progress', () => {
    const onPollingChange = vi.fn();
    renderPanel(
      populated({
        isEstimated: true,
        variantFetchProgress: { fetchId: 'f', total: 2, completed: 0, failed: 0, inProgress: true },
      }),
      { onPollingChange },
    );

    expect(onPollingChange).toHaveBeenLastCalledWith(expect.any(Number));
    expect(screen.getByRole('status')).toHaveTextContent('Verificando carta 1 de 2');
  });

  it('shows the retry affordance when the store query errored', () => {
    const onShoppingRetry = vi.fn();
    renderPanel({ kind: 'error', reason: 'x' }, { onShoppingRetry });

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onShoppingRetry).toHaveBeenCalledTimes(1);
  });

  it('still wires Mark owned per row', () => {
    const onMarkOwned = vi.fn();
    renderPanel(populated(), { onMarkOwned });

    const button = within(rowOf('Card B')).getByRole('button', { name: 'Marcar como possuída' });
    expect(button).toHaveClass(markOwnedStyles.btn!);
    fireEvent.click(button);
    expect(onMarkOwned).toHaveBeenCalledWith('card-b');
  });
});
