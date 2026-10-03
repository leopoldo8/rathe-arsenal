/**
 * Tests for the /add-cards tab shell, its index redirect, and the Fabrary
 * subview's URL handling. The Manual + CSV subviews lean on already-tested
 * mutations (useAddCardMutation, useUploadCsvMutation).
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
// Mocks for the Fabrary import API hook (so we don't hit the network)
// ---------------------------------------------------------------------------

const fabraryMutate = vi.fn();
const fabraryMutationState: {
  isPending: boolean;
  data: unknown;
} = { isPending: false, data: null };

vi.mock('../../../api/fabrary-import', () => ({
  useFabraryLibraryImportMutation: () => ({
    mutate: fabraryMutate,
    isPending: fabraryMutationState.isPending,
  }),
}));

// ---------------------------------------------------------------------------
// Imports under test (after the vi.mock declarations)
// ---------------------------------------------------------------------------

import { AddCardsLayout } from '../add-cards';
import { Route as IndexRoute } from '../add-cards.index';
import styles from '../add-cards.module.css';
import { AddCardsFabraryPage } from '../add-cards.fabrary';

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

const TAB_PATHS = ['/add-cards/manual', '/add-cards/csv', '/add-cards/fabrary'] as const;

describe('AddCardsLayout — tab shell (LIB-07)', () => {
  beforeEach(() => {
    mockLocation.pathname = '/add-cards/manual';
    linkSpy.mockClear();
  });

  it('renders the page title and the one-line subtitle', () => {
    renderInRouter(<AddCardsLayout />);
    expect(screen.getByRole('heading', { name: /^Adicionar cartas$/i })).toBeInTheDocument();
    expect(
      screen.getByText('Três caminhos — escolha o que serve ao momento.'),
    ).toBeInTheDocument();
  });

  it('renders the three tabs through the router Link, in order', () => {
    renderInRouter(<AddCardsLayout />);
    const nav = screen.getByRole('navigation', { name: /métodos/i });
    const tabs = within(nav).getAllByRole('link');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Manual',
      'Importar CSV',
      'Deck do Fabrary',
    ]);
    expect(tabs.map((tab) => tab.getAttribute('href'))).toEqual([...TAB_PATHS]);
    for (const path of TAB_PATHS) {
      expect(linkSpy).toHaveBeenCalledWith(expect.objectContaining({ to: path }));
    }
  });

  it.each(TAB_PATHS)('marks only the %s tab active', (path) => {
    mockLocation.pathname = path;
    renderInRouter(<AddCardsLayout />);
    const nav = screen.getByRole('navigation', { name: /métodos/i });
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
    expect(screen.queryByText(/Busque no catálogo e ajuste/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Importe as cartas de um deck público/)).not.toBeInTheDocument();
  });

  it('shows the manual and fabrary sentences on their own tabs', () => {
    mockLocation.pathname = '/add-cards/manual';
    const { unmount } = renderInRouter(<AddCardsLayout />);
    expect(screen.getByText('Busque no catálogo e ajuste a quantidade que você possui.')).toBeInTheDocument();
    unmount();
    mockLocation.pathname = '/add-cards/fabrary';
    renderInRouter(<AddCardsLayout />);
    expect(screen.getByText('Importe as cartas de um deck público do Fabrary.')).toBeInTheDocument();
  });

  it('localizes tabs and sentences under en-US', async () => {
    await setTestLocale('en-US');
    mockLocation.pathname = '/add-cards/csv';
    renderInRouter(<AddCardsLayout />);
    expect(screen.getByRole('link', { name: 'Import CSV' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fabrary deck' })).toBeInTheDocument();
    expect(screen.getByText('Upload a spreadsheet exported from another tool.')).toBeInTheDocument();
  });

  it('no longer renders the roman numerals or the three long method paragraphs', () => {
    renderInRouter(<AddCardsLayout />);
    expect(screen.queryByText(/^(I|II|III)$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ideal para ajustes rápidos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cole uma URL de baralho/)).not.toBeInTheDocument();
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

describe('/add-cards index route', () => {
  it('redirects to the manual tab instead of rendering its own panel', () => {
    const beforeLoad = (IndexRoute as unknown as { beforeLoad: () => void }).beforeLoad;
    let thrown: unknown;
    try {
      beforeLoad();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({ isRedirect: true, to: '/add-cards/manual' });
  });
});

// ---------------------------------------------------------------------------
// /add-cards/fabrary (new endpoint consumer)
// ---------------------------------------------------------------------------

describe('AddCardsFabraryPage', () => {
  beforeEach(() => {
    fabraryMutate.mockReset();
    fabraryMutationState.isPending = false;
  });

  it('rejects an obviously invalid URL on submit', async () => {
    renderInRouter(<AddCardsFabraryPage />);
    const input = screen.getByLabelText(/URL do baralho do Fabrary/i);
    await userEvent.type(input, 'not-a-url');
    await userEvent.click(screen.getByRole('button', { name: /^Importar cartas$/i }));
    expect(fabraryMutate).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Não é uma URL de baralho Fabrary válida/i),
    ).toBeInTheDocument();
  });

  it('calls the import mutation when a valid URL is submitted', async () => {
    renderInRouter(<AddCardsFabraryPage />);
    const input = screen.getByLabelText(/URL do baralho do Fabrary/i);
    fireEvent.change(input, {
      target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
    });
    await userEvent.click(screen.getByRole('button', { name: /^Importar cartas$/i }));
    expect(fabraryMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://fabrary.net/decks/01HABCDEFG12345',
      }),
      expect.any(Object),
    );
  });

  it('disables the submit button while submitting', () => {
    fabraryMutationState.isPending = true;
    renderInRouter(<AddCardsFabraryPage />);
    fabraryMutationState.isPending = false; // restore for next test
    const button = screen.getByRole('button', { name: /^Importar cartas$/i });
    expect(button).toBeDisabled();
  });

  it('Enter on the input triggers submission when the URL is valid', async () => {
    renderInRouter(<AddCardsFabraryPage />);
    const input = screen.getByLabelText(/URL do baralho do Fabrary/i);
    fireEvent.change(input, {
      target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
    });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(fabraryMutate).toHaveBeenCalled());
  });

  it('points to New deck for readiness tracking, through the router Link', () => {
    linkSpy.mockClear();
    renderInRouter(<AddCardsFabraryPage />);
    expect(screen.getByText(/Para acompanhar a prontidão do deck, use/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Novo deck' })).toHaveAttribute('href', '/decks/new');
    expect(linkSpy).toHaveBeenCalledWith(expect.objectContaining({ to: '/decks/new' }));
  });

  it('no longer renders its own page header (the shell owns it)', () => {
    renderInRouter(<AddCardsFabraryPage />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
