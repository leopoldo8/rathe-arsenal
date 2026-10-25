/**
 * Tests for the /add-cards tab shell and its index page, the paste box. The Manual + CSV subviews
 * lean on already-tested mutations (useAddCardMutation, useUploadCsvMutation).
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setTestLocale } from '../../../test/i18n-test-utils';

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
// /add-cards (tab shell)
// ---------------------------------------------------------------------------

const TAB_PATHS = ['/add-cards/manual', '/add-cards/csv', '/add-cards/scan'] as const;

describe('AddCardsLayout — tab shell (LIB-07)', () => {
  beforeEach(() => {
    mockLocation.pathname = '/add-cards/manual';
    linkSpy.mockClear();
  });

  it('renders the page title and the one-line subtitle', () => {
    renderInRouter(<AddCardsLayout />);
    expect(screen.getByRole('heading', { name: /^Adicionar cartas$/i })).toBeInTheDocument();
    expect(
      screen.getByText('Registre as cartas que você tem na sua coleção.'),
    ).toBeInTheDocument();
  });

  it('renders the three tabs through the router Link, in order', () => {
    renderInRouter(<AddCardsLayout />);
    const nav = screen.getByRole('navigation', { name: /formas de adicionar/i });
    const tabs = within(nav).getAllByRole('link');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Manual',
      'Importar CSV',
      'Escanear',
    ]);
    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual([...TAB_PATHS]);
    for (const path of TAB_PATHS) {
      expect(linkSpy).toHaveBeenCalledWith(expect.objectContaining({ to: path }));
    }
  });

  it.each(TAB_PATHS)('marks only the %s tab active', (path) => {
    mockLocation.pathname = path;
    renderInRouter(<AddCardsLayout />);
    const nav = screen.getByRole('navigation', { name: /formas de adicionar/i });
    const tabs = within(nav).getAllByRole('link');
    const active = tabs.filter((tab) => tab.getAttribute('data-active') === 'true');
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute('href', path);
    expect(active[0]).toHaveAttribute('aria-current', 'page');
    expect(active[0]).toHaveClass(styles.tab!);
    expect(tabs.filter((tab) => tab !== active[0]).every((tab) => !tab.hasAttribute('aria-current'))).toBe(true);
  });

  it('shows exactly one explanatory sentence, the one for the active tab', () => {
    mockLocation.pathname = '/add-cards/csv';
    renderInRouter(<AddCardsLayout />);
    expect(screen.getByText('Envie uma planilha exportada de outra ferramenta.')).toBeInTheDocument();
    expect(screen.queryByText(/Busque a carta e informe/)).not.toBeInTheDocument();
  });

  it('shows the manual sentence on its own tab, and no Fabrary tab', () => {
    mockLocation.pathname = '/add-cards/manual';
    renderInRouter(<AddCardsLayout />);
    expect(screen.getByText('Busque a carta e informe quantas você tem.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deck do Fabrary' })).not.toBeInTheDocument();
  });

  it('shows the Scan tab', async () => {
    await setTestLocale('en-US');
    mockLocation.pathname = '/add-cards/scan';
    renderInRouter(<AddCardsLayout />);

    const scanTab = screen.getByRole('link', { name: 'Scan' });
    expect(scanTab).toHaveAttribute('href', '/add-cards/scan');
    expect(scanTab).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText("Point your phone's camera at your cards, one at a time.")).toBeInTheDocument();
  });

  it('localizes tabs and sentences under en-US', async () => {
    await setTestLocale('en-US');
    mockLocation.pathname = '/add-cards/csv';
    renderInRouter(<AddCardsLayout />);
    expect(screen.getByRole('link', { name: 'Import CSV' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Fabrary deck' })).not.toBeInTheDocument();
    expect(screen.getByText('Upload a spreadsheet exported from another tool.')).toBeInTheDocument();
  });

  it('no longer renders the roman numerals or the three long method paragraphs', () => {
    renderInRouter(<AddCardsLayout />);
    expect(screen.queryByText(/^(I|II|III)$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ideal para ajustes rápidos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cole o link de um deck/)).not.toBeInTheDocument();
  });

  it('renders the active tab body (Outlet) inside the surface panel', () => {
    renderInRouter(<AddCardsLayout />);
    const panel = screen.getByTestId('tab-outlet').closest('section');
    expect(panel).toHaveClass(styles.panel!);
  });

  it('links back to the library and on to the sources page', () => {
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

  it('shows the paste box with its hint before anything is pasted', () => {
    renderInRouter(<AddCardsIndexPage />);
    expect(screen.getByPlaceholderText('Cole aqui')).toBeInTheDocument();
    expect(screen.getByText('Cole um link de deck (do Fabrary, por exemplo) ou uma lista de cartas')).toBeInTheDocument();
  });
});
