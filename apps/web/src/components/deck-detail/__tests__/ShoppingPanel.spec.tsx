/**
 * Unit tests for <ShoppingPanel /> — desktop sticky + mobile sheet (R24, R57)
 *
 * Test scenarios from Unit 16 plan:
 *  - Desktop panel renders with aside landmark
 *  - Mobile bar renders "View shopping list" with price
 *  - Clicking mobile bar opens the Dialog sheet
 *  - Sheet has aria-labelledby pointing to "Shopping list" heading
 *  - Close button closes the sheet
 *  - ShoppingLine content appears in both desktop and sheet
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import { ShoppingPanel } from '../ShoppingPanel';
import { MissingListPage } from '../../missing-list/MissingListPage';
import { line as missingLine, response as missingResponse } from '../../missing-list/__tests__/missingListKit';
import type { IShoppingLineResponse } from '../../../api/shopping-line';

const mockApiFetch = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => mockApiFetch,
}));
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock('../ShareDialog', () => ({ ShareDialog: () => null }));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const POPULATED_DATA: IShoppingLineResponse = {
  kind: 'populated',
  storeName: 'Cupula DT',
  storeHostname: 'www.cupuladt.com.br',
  totalCostCents: 4990,
  availableCardCount: 1,
  unavailableCardCount: 0,
  lines: [
    {
      cardIdentifier: 'pummel',
      cardName: 'Pummel',
      pitch: null,
      quantityNeeded: 3,
      quantityAvailable: 3,
      unitPriceCents: 1663,
      productUrl: 'https://www.cupuladt.com.br/?id=1',
      lastFetchedAt: TWO_HOURS_AGO,
    },
  ],
  lastFetchedAt: TWO_HOURS_AGO,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShoppingPanel', () => {
  describe('desktop panel', () => {
    it('renders an aside landmark for the desktop panel', () => {
      render(<ShoppingPanel data={null} />);
      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('desktop panel has accessible label "Shopping list"', () => {
      render(<ShoppingPanel data={null} />);
      expect(
        screen.getByRole('complementary', { name: /lista de compras/i }),
      ).toBeInTheDocument();
    });
  });

  describe('mobile sticky bar', () => {
    it('renders the mobile sticky bar button', () => {
      render(<ShoppingPanel data={null} />);
      expect(
        screen.getByTestId('shopping-panel-mobile-bar'),
      ).toBeInTheDocument();
    });

    it('shows "View shopping list" text in the bar', () => {
      render(<ShoppingPanel data={null} />);
      expect(screen.getByText(/ver lista de compras/i)).toBeInTheDocument();
    });

    it('shows the total cost in the bar when data is populated', () => {
      render(<ShoppingPanel data={POPULATED_DATA} />);
      // Price must appear in the button label: "View shopping list · R$ 49,90"
      // (4990 cents → R$ 49,90). Asserting just /view shopping list/ would pass
      // even if the price was never rendered — assert the full label here.
      expect(
        screen.getByText(/ver lista de compras.*R\$.*49/i),
      ).toBeInTheDocument();
    });
  });

  describe('mobile bottom sheet', () => {
    it('opens the dialog sheet when mobile bar is clicked', async () => {
      render(<ShoppingPanel data={null} />);
      const bar = screen.getByRole('button', { name: /ver lista de compras/i });
      fireEvent.click(bar);
      await waitFor(() => {
        expect(screen.getByTestId('shopping-panel-sheet')).toBeInTheDocument();
      });
    });

    it('sheet has a "Shopping list" heading', async () => {
      render(<ShoppingPanel data={null} />);
      fireEvent.click(screen.getByRole('button', { name: /ver lista de compras/i }));
      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /lista de compras/i }),
        ).toBeInTheDocument();
      });
    });

    it('sheet is closed when X button is clicked', async () => {
      render(<ShoppingPanel data={null} />);
      fireEvent.click(screen.getByRole('button', { name: /ver lista de compras/i }));
      await waitFor(() => {
        expect(screen.getByTestId('shopping-panel-sheet')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /fechar lista de compras/i }));
      await waitFor(() => {
        expect(screen.queryByTestId('shopping-panel-sheet')).not.toBeInTheDocument();
      });
    });

    it('sheet dialog has aria-labelledby pointing to the title', async () => {
      render(<ShoppingPanel data={null} />);
      fireEvent.click(screen.getByRole('button', { name: /ver lista de compras/i }));
      await waitFor(() => {
        const sheet = screen.getByTestId('shopping-panel-sheet');
        const labelId = sheet.getAttribute('aria-labelledby');
        expect(labelId).toBeTruthy();
        const title = document.getElementById(labelId!);
        expect(title).toHaveTextContent(/lista de compras/i);
      });
    });
  });

  describe('ShoppingLine content', () => {
    it('renders Path A empty state in the desktop panel when data is null', () => {
      render(<ShoppingPanel data={null} />);
      // ShoppingLine null → Path A message
      expect(
        screen.getAllByText(/você já tem tudo o que este deck precisa/i).length,
      ).toBeGreaterThan(0);
    });
  });
});

describe('the shopping list of the missing list page', () => {
  it('the shopping list splits deck and inventory', async () => {
    const lines = [
      missingLine({ cardIdentifier: 'a', name: 'Alpha', deckNeeded: 3, deckQuantity: 3, availableCopies: 3, lineCents: 300 }),
      missingLine({ cardIdentifier: 'b', name: 'Bravo', deckNeeded: 1, deckQuantity: 1, availableCopies: 1, lineCents: 100 }),
      missingLine({ cardIdentifier: 'c', name: 'Charlie', deckNeeded: 0, inventoryNeeded: 2, deckQuantity: 2, availableCopies: 2, lineCents: 200 }),
      missingLine({ cardIdentifier: 'd', name: 'Delta', deckNeeded: 0, inventoryNeeded: 1, deckQuantity: 1, availableCopies: 1, lineCents: 100 }),
    ];
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/decks/7/missing') return missingResponse(lines, { buyCopies: 7, buyCents: 700 });
      return { id: 7, name: 'Deck', hero: 'Rhinar' };
    });

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MissingListPage deckId={7} />
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId('shopping-split')).toHaveTextContent('4 do deck, 3 do inventário');
  });
});
