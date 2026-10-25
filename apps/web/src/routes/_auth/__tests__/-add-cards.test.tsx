/**
 * Tests for the /add-cards tab shell and its index page, the paste box. The Manual + CSV subviews
 * lean on already-tested mutations (useAddCardMutation, useUploadCsvMutation).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mocks for TanStack router
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
const mockLocation = { pathname: '/add-cards/manual' };
const linkSpy = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (config: Record<string, unknown>) => ({
    ...config,
    useSearch: () => ({}),
  }),
  redirect: (options: Record<string, unknown>) => ({ isRedirect: true, ...options }),
  useNavigate: () => mockNavigate,
  useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
    select(mockLocation),
  Outlet: () => <div data-testid="tab-outlet">tab body</div>,
  Link: (props: {
    children: React.ReactNode;
    to: string;
    className?: string;
    'data-active'?: string;
    'aria-current'?: 'page';
  }) => {
    linkSpy(props);
    return (
      <a
        href={props.to}
        className={props.className}
        data-active={props['data-active']}
        aria-current={props['aria-current']}
      >
        {props.children}
      </a>
    );
  },
}));

// ---------------------------------------------------------------------------
// Mocks for the Fabrary import API hooks (so we don't hit the network)
// ---------------------------------------------------------------------------

vi.mock('../../../api/fabrary-import', () => ({
  useFabraryPreviewQuery: () => ({
    isPending: false,
    isError: false,
    error: null,
    data: { name: '[CC] Rhinar Brute', hero: 'Rhinar', format: 'Classic Constructed', totalCards: 66, ownedCards: 0 },
  }),
  useImportFabraryDeckMutation: () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null }),
}));

// ---------------------------------------------------------------------------
// Imports under test (after the vi.mock declarations)
// ---------------------------------------------------------------------------

import { AddCardsLayout } from '../add-cards';
import { AddCardsIndexPage } from '../add-cards.index';
import styles from '../add-cards.module.css';
import { peekPastedList } from '../../../lib/pasted-list';

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderInRouter(node: React.ReactNode): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      {node}
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// /add-cards (shell)
// ---------------------------------------------------------------------------

describe('AddCardsLayout (LIB-07)', () => {
  beforeEach(() => {
    mockLocation.pathname = '/add-cards';
    linkSpy.mockClear();
  });

  it('draws the heading and no subtitle, tab bar or sentence on the entry screen', () => {
    renderInRouter(<AddCardsLayout />);
    expect(screen.getByRole('heading', { name: /^Adicionar cartas$/i })).toBeInTheDocument();
    expect(screen.queryByText('Registre as cartas que você tem na sua coleção.')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /formas de adicionar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deck do Fabrary' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Biblioteca/ })).not.toBeInTheDocument();
  });

  it('renders the page body (Outlet) straight on the entry screen and inside the surface panel below it', () => {
    const entry = renderInRouter(<AddCardsLayout />);
    expect(screen.getByTestId('tab-outlet').closest('section')).toBeNull();
    entry.unmount();

    mockLocation.pathname = '/add-cards/manual';
    renderInRouter(<AddCardsLayout />);
    expect(screen.getByTestId('tab-outlet').closest('section')).toHaveClass(styles.panel!);
  });

  it('links back to the library and on to the sources page below the entry screen', () => {
    mockLocation.pathname = '/add-cards/csv';
    renderInRouter(<AddCardsLayout />);
    expect(screen.getByRole('link', { name: /Biblioteca/ })).toHaveAttribute('href', '/library');
    expect(screen.getByRole('link', { name: /Gerenciar fontes da biblioteca/ })).toHaveAttribute(
      'href',
      '/library-csv-sources',
    );
    expect(linkSpy).toHaveBeenCalledWith(expect.objectContaining({ to: '/library-csv-sources' }));
  });

  it('centres the column in a 900px wrapper', () => {
    const { container } = renderInRouter(<AddCardsLayout />);
    expect(container.firstElementChild).toHaveClass(styles.page!);
  });
});

describe('/add-cards index page', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('the paste box routes a link to the deck and a list to the reader', async () => {
    const user = userEvent.setup();

    const withLink = renderInRouter(<AddCardsIndexPage />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('olha meu deck https://fabrary.net/decks/01J0Z8K4M2ABCDEFGHJKMNPQRS valeu');
    expect(screen.getByText('Deck do Fabrary encontrado: [CC] Rhinar Brute · 66 cartas')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sim, colocar na minha coleção' })).not.toBeChecked();
    expect(mockNavigate).not.toHaveBeenCalled();
    withLink.unmount();

    renderInRouter(<AddCardsIndexPage />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('3x Snatch (Red)\n2 Command and Conquer vermelho');
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/add-cards/list' });
    expect(peekPastedList()).toBe('3x Snatch (Red)\n2 Command and Conquer vermelho');
    expect(screen.queryByText(/Deck do Fabrary encontrado/)).not.toBeInTheDocument();
  });

  it('matches r3-add-phone copy and order', () => {
    renderInRouter(<AddCardsIndexPage />);

    const paste = screen.getByPlaceholderText('Cole aqui');
    const hint = screen.getByText('Cole um link de deck (do Fabrary, por exemplo) ou uma lista de cartas');
    const rows = screen.getAllByRole('link');
    expect(rows.map((row) => row.textContent?.replace('›', '').trim())).toEqual([
      'Comprei um deck pronto',
      'Enviar uma planilha (.csv)',
      'Fotografar as cartas',
      'Digitar o nome',
    ]);
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/add-cards/product',
      '/add-cards/csv',
      '/add-cards/scan',
      '/add-cards/manual',
    ]);
    const order = [paste, hint, ...rows];
    order.slice(1).forEach((node, index) => {
      expect(order[index]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('puts the ways in away once a deck link is found', async () => {
    const user = userEvent.setup();
    renderInRouter(<AddCardsIndexPage />);
    await user.click(screen.getByRole('textbox'));
    await user.paste('https://fabrary.net/decks/01J0Z8K4M2ABCDEFGHJKMNPQRS');

    expect(screen.queryByRole('link', { name: /Comprei um deck pronto/ })).not.toBeInTheDocument();
  });
});
