/**
 * Unit tests for <DeckDetailLayout /> (U11)
 *
 * Test scenarios:
 *  - Happy path: renders header + sidebar + canvas slots at desktop width.
 *  - Happy path: all three regions receive their slot content.
 *  - Happy path: sidebar has the "Deck details" aria-label landmark.
 *  - Happy path: canvas is the main content area.
 *  - Happy path: below 1280px, sidebar becomes a card under the header
 *    (layout tested structurally; CSS-only collapse tested via SidebarCollapseToggle).
 *  - Layout: the page wrapper has the correct data-testid.
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeckDetailLayout } from '../DeckDetailLayout';
import { DeckHeroBanner } from '../DeckHeroBanner';
import { DeckCauseLine } from '../DeckCauseLine';
import { DeckList } from '../DeckList';
import { buildDeckList } from '../deckListModel';
import { breakdown, entry } from './deckDetailTestData';

const spies = vi.hoisted(() => ({
  realMenu: false,
  apiFetch: vi.fn(),
  navigate: vi.fn(),
  show: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/home">{children}</a>,
  useNavigate: () => spies.navigate,
}));
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => spies.apiFetch };
});
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: spies.show }) }));
vi.mock('../StatusDropdown', () => ({ StatusDropdown: () => null }));
vi.mock('../DeckNameInline', () => ({ DeckNameInline: ({ name }: { name: string }) => <h1>{name}</h1> }));
// The real menu only where a test reads it; the other tests of this file never look at it.
vi.mock('../DeckOverflowMenu', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../DeckOverflowMenu')>();
  return {
    DeckOverflowMenu: (props: { deckId: number; deckName: string }) =>
      spies.realMenu ? <actual.DeckOverflowMenu {...props} /> : null,
  };
});
vi.mock('../useDeckHero', () => ({ useDeckHero: () => ({ name: 'Rhinar', art: null, bannerSources: [] }) }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLayout({
  header = <div data-testid="header-slot">Header</div>,
  sidebar = <div data-testid="sidebar-slot">Sidebar</div>,
  canvas = <div data-testid="canvas-slot">Canvas</div>,
} = {}) {
  return render(
    <DeckDetailLayout header={header} sidebar={sidebar} canvas={canvas} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckDetailLayout — structure', () => {
  it('renders all three slot regions', () => {
    renderLayout();
    expect(screen.getByTestId('header-slot')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-slot')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-slot')).toBeInTheDocument();
  });

  it('has the deck-detail-layout data-testid wrapper', () => {
    renderLayout();
    expect(screen.getByTestId('deck-detail-layout')).toBeInTheDocument();
  });

  it('renders header inside a <header> element', () => {
    renderLayout();
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    expect(header).toContainElement(screen.getByTestId('header-slot'));
  });

  it('renders sidebar inside an <aside> element with aria-label "Detalhes do deck"', () => {
    renderLayout();
    const aside = screen.getByRole('complementary', { name: 'Detalhes do deck' });
    expect(aside).toBeInTheDocument();
    expect(aside).toContainElement(screen.getByTestId('sidebar-slot'));
  });

  it('renders canvas inside a <main> element', () => {
    renderLayout();
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId('canvas-slot'));
  });
});

describe('DeckDetailLayout — slot content', () => {
  it('header slot renders arbitrary React nodes', () => {
    renderLayout({
      header: (
        <nav>
          <a href="/home">← Decks</a>
          <h1>My Deck</h1>
        </nav>
      ),
    });
    expect(screen.getByText('← Decks')).toBeInTheDocument();
    expect(screen.getByText('My Deck')).toBeInTheDocument();
  });

  it('sidebar slot renders arbitrary React nodes', () => {
    renderLayout({
      sidebar: (
        <div>
          <p>Hero Block</p>
          <p>Readiness Block</p>
        </div>
      ),
    });
    expect(screen.getByText('Hero Block')).toBeInTheDocument();
    expect(screen.getByText('Readiness Block')).toBeInTheDocument();
  });

  it('canvas slot renders arbitrary React nodes', () => {
    renderLayout({
      canvas: (
        <div>
          <section aria-label="Exact matches">Exact</section>
          <section aria-label="Swaps">Swaps</section>
          <section aria-label="Not owned">Not owned</section>
        </div>
      ),
    });
    expect(screen.getByText('Exact')).toBeInTheDocument();
    expect(screen.getByText('Swaps')).toBeInTheDocument();
    expect(screen.getByText('Not owned')).toBeInTheDocument();
  });
});

describe('DeckDetailLayout — mobile behavior', () => {
  it('sidebar renders in the document tree (CSS controls collapse below 1280px)', () => {
    // The layout always renders the sidebar in the DOM.
    // CSS toggles visibility below 1280px via DeckDetailSidebar's collapse logic.
    renderLayout({
      sidebar: <div data-testid="mobile-sidebar">Mobile sidebar content</div>,
    });
    // The sidebar element is in the DOM regardless of viewport width.
    expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
  });
});

function withClient(node: React.ReactElement): React.ReactElement {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  spies.realMenu = false;
  spies.apiFetch.mockReset();
  spies.navigate.mockReset();
  spies.show.mockReset();
});

describe('DeckDetailLayout — the verdict and the stage', () => {
  const copyProblems = Array.from({ length: 8 }, (_, index) => ({
    code: 'too_many_copies',
    params: { card: `c${index}`, cardIdentifier: `c${index}`, pitch: 1, count: 2, limit: 1, format: 'Blitz', legendary: false, restricted: false },
  }));
  const legality = { category: 'illegal' as const, reasons: ['x'], details: copyProblems };

  it('the header shows the verdict and the stage apart', () => {
    render(
      withClient(
        <DeckDetailLayout
          header={
            <DeckHeroBanner
              deckId={7}
              deckName="Rhinar Blitz"
              status="active"
              format="Blitz"
              legality={legality}
              heroIdentifier="rhinar"
              heroFallbackName="Rhinar"
              pct={100}
              onEdit={vi.fn()}
              onShare={vi.fn()}
              onCopyList={vi.fn()}
            />
          }
          sidebar={null}
          canvas={<DeckCauseLine legality={legality} />}
        />,
      ),
    );

    const header = screen.getByRole('banner');
    expect(within(header).getByTestId('legality-badge')).toHaveTextContent('Não vale no Blitz');
    expect(within(header).getByTestId('deck-stage-line')).toHaveTextContent('Etapa: Jogando');
    expect(header).not.toHaveTextContent('8 cartas com 2 cópias');
    expect(within(screen.getByRole('main')).getByTestId('deck-cause')).toHaveTextContent('8 cartas com 2 cópias');
  });
});

const illegalCc = {
  category: 'illegal' as const,
  reasons: ['x'],
  details: [
    {
      code: 'too_many_copies',
      params: { card: 'Pack Hunt', cardIdentifier: 'pack-hunt-red', pitch: 1, count: 4, limit: 3, format: 'Classic Constructed', legendary: false, restricted: false },
    },
  ],
};

function renderDeckPage(canvas: React.ReactNode = null, onCopyList = vi.fn()): void {
  render(
    withClient(
      <DeckDetailLayout
        header={
          <DeckHeroBanner
            deckId={7}
            deckName="Rhinar CC"
            status="ready"
            format="Classic Constructed"
            legality={illegalCc}
            heroIdentifier="rhinar"
            heroFallbackName="Rhinar"
            pct={100}
            onEdit={vi.fn()}
            onShare={vi.fn()}
            onCopyList={onCopyList}
          />
        }
        sidebar={null}
        canvas={canvas}
      />,
    ),
  );
}

describe('DeckDetailLayout — getting the list out', () => {
  it('copy list and duplicate are visible, delete only in the menu', async () => {
    spies.realMenu = true;
    const user = userEvent.setup();
    renderDeckPage();
    const header = screen.getByRole('banner');

    expect(within(header).getByRole('button', { name: 'Copiar lista' })).toBeVisible();
    expect(within(header).getByRole('button', { name: 'Duplicar' })).toBeVisible();
    expect(within(header).getByText('Copiar lista: texto para o grupo ou para o Fabrary')).toBeInTheDocument();
    expect(
      within(header).getByText('Duplicar: cria uma cópia para testar mudanças sem mexer neste'),
    ).toBeInTheDocument();
    expect(within(header).queryByText('Excluir deck')).not.toBeInTheDocument();

    await user.click(within(header).getByRole('button', { name: 'Mais ações do deck' }));

    const menu = within(header).getByRole('menu');
    expect(within(menu).getByText('Excluir deck')).toBeInTheDocument();
    expect(within(menu).queryByText('Copiar lista')).not.toBeInTheDocument();
    expect(within(menu).queryByText('Duplicar')).not.toBeInTheDocument();
  });

  it('duplicate opens the new deck', async () => {
    spies.apiFetch.mockResolvedValue({ deckId: 42 });
    const user = userEvent.setup();
    renderDeckPage();

    await user.click(screen.getByRole('button', { name: 'Duplicar' }));

    await waitFor(() => expect(spies.navigate).toHaveBeenCalledTimes(1));
    expect(spies.apiFetch).toHaveBeenCalledWith('/decks/7/duplicate', { method: 'POST' });
    expect(spies.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/decks/$deckId', params: { deckId: '42' } }),
    );
  });

  it('says so when the copy could not be made, and stays on the deck', async () => {
    spies.apiFetch.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderDeckPage();

    await user.click(screen.getByRole('button', { name: 'Duplicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não deu para duplicar o deck. Tente de novo.');
    expect(spies.navigate).not.toHaveBeenCalled();
  });

  it('copy list asks the page to open the sheet', async () => {
    const onCopyList = vi.fn();
    const user = userEvent.setup();
    renderDeckPage(null, onCopyList);

    await user.click(screen.getByRole('button', { name: 'Copiar lista' }));

    expect(onCopyList).toHaveBeenCalledTimes(1);
  });

  it('excluir deck soft-deletes and returns home with the toast', async () => {
    spies.realMenu = true;
    spies.apiFetch.mockResolvedValue({ deletedAt: '2026-10-24T12:00:00.000Z' });
    const user = userEvent.setup();
    renderDeckPage();

    await user.click(screen.getByRole('button', { name: 'Mais ações do deck' }));
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem'));

    await waitFor(() => expect(spies.navigate).toHaveBeenCalledTimes(1));
    expect(spies.apiFetch).toHaveBeenCalledTimes(1);
    expect(spies.apiFetch).toHaveBeenCalledWith('/decks/7', { method: 'DELETE' });
    expect(spies.navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/home' }));
    expect(spies.show).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Rhinar CC foi para Excluídos recentemente',
        persistent: true,
        action: expect.objectContaining({ label: 'Desfazer' }),
      }),
    );
  });

  it('stays on the deck and says so when the delete is refused', async () => {
    spies.realMenu = true;
    spies.apiFetch.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderDeckPage();

    await user.click(screen.getByRole('button', { name: 'Mais ações do deck' }));
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem'));

    await waitFor(() => expect(spies.show).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error' })));
    expect(spies.navigate).not.toHaveBeenCalled();
  });

  it('matches r3-deck-actions-desktop', () => {
    spies.realMenu = true;
    const rows = Array.from({ length: 20 }, (_, index) =>
      entry({ cardIdentifier: `card-${index}`, name: `Card ${index}`, quantity: 3 }),
    );
    const items = buildDeckList(breakdown({ exact: rows }), []);
    renderDeckPage(<DeckList items={items} />);

    const ordered = [
      screen.getByText('‹ Decks'),
      screen.getByRole('heading', { name: 'Rhinar CC' }),
      screen.getByText('Classic Constructed'),
      screen.getByText('Não vale no Classic Constructed'),
      screen.getByText('Etapa: Pronto'),
      screen.getByRole('button', { name: 'Copiar lista' }),
      screen.getByRole('button', { name: 'Duplicar' }),
      screen.getByRole('button', { name: 'Mais ações do deck' }),
      screen.getByRole('heading', { name: 'Deck' }),
      screen.getByText('60 cartas'),
      screen.getAllByTestId('deck-list-qty')[0]!,
    ];
    ordered.slice(1).forEach((node, index) => {
      expect(ordered[index]!.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(screen.getAllByTestId('deck-list-qty')[0]).toHaveTextContent('3×');
  });
});
