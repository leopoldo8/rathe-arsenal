import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StatusGroups } from '../StatusGroups';
import { ITrackedDeckListItem, TDeckStatus } from '../../../api/decks';
import { ToastProvider } from '../../ui/Toast/ToastProvider';

// ---------------------------------------------------------------------------
// Mock TanStack Router — Link renders as a plain <a>
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: ({
      children,
      to,
      params,
      className,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
      className?: string;
      'data-testid'?: string;
    }) => {
      const href = params ? to.replace('$deckId', params.deckId ?? '') : to;
      return (
        <a href={href} className={className} data-testid={testId}>
          {children}
        </a>
      );
    },
  };
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDeck(
  id: number,
  status: TDeckStatus,
  name = `Deck ${id}`,
  tags: string[] = [],
): ITrackedDeckListItem {
  return {
    id,
    fabraryUlid: `ulid-${id}`,
    name,
    hero: 'Rhinar',
    format: 'Classic Constructed',
    trackedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status,
    tags,
    legality: { category: 'legal', reasons: [] },
    latestSnapshot: { rawPercent: 80, effectivePercent: 80, computedAt: '' },
    heroImageUrl: null,
    representativeCards: [],
    cardCounts: { owned: 60, missing: 7, total: 67 },
  };
}

function renderGroups(
  decks: readonly ITrackedDeckListItem[],
  isAllRetired = decks.length > 0 && decks.every((d) => d.status === 'retired'),
  onUntrack = vi.fn(),
) {
  return render(
    <ToastProvider>
      <StatusGroups
        decks={decks}
        onUntrack={onUntrack}
        untrackingDeckId={null}
        isAllRetired={isAllRetired}
      />
    </ToastProvider>,
  );
}

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

let localStorageMock: Record<string, string> = {};

const localStorageStub = {
  getItem: (key: string) => localStorageMock[key] ?? null,
  setItem: (key: string, value: string) => {
    localStorageMock[key] = value;
  },
  removeItem: (key: string) => {
    delete localStorageMock[key];
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatusGroups', () => {
  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', localStorageStub);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders four groups in order for decks spanning all five statuses', () => {
    renderGroups([
      makeDeck(1, 'retired', 'Retired Deck'),
      makeDeck(2, 'idea', 'Idea Deck'),
      makeDeck(3, 'building', 'Building Deck'),
      makeDeck(4, 'ready', 'Ready Deck'),
      makeDeck(5, 'active', 'Active Deck'),
    ]);

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Ativos', 'Construindo', 'Ideias', 'Aposentados']);
  });

  it('puts ready and active decks under the one Ativos group with a combined count', () => {
    renderGroups([makeDeck(1, 'ready', 'Ready Deck'), makeDeck(2, 'active', 'Active Deck')]);

    const section = screen.getByRole('heading', { name: 'Ativos', level: 2 }).closest('section')!;
    expect(within(section).getByLabelText('Ready Deck')).toBeInTheDocument();
    expect(within(section).getByLabelText('Active Deck')).toBeInTheDocument();
    expect(within(section).getByText('2 decks')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /pronto/i, level: 2 })).not.toBeInTheDocument();
  });

  it('shows the singular count for a one-deck group', () => {
    renderGroups([makeDeck(1, 'building', 'Only')]);
    expect(screen.getByText('1 deck')).toBeInTheDocument();
  });

  it('shows each group hint line', () => {
    renderGroups([
      makeDeck(1, 'active'),
      makeDeck(2, 'building'),
      makeDeck(3, 'idea'),
      makeDeck(4, 'retired'),
    ]);
    expect(screen.getByText('Prontos para o jogo')).toBeInTheDocument();
    expect(screen.getByText('Ainda em ajuste')).toBeInTheDocument();
    expect(screen.getByText('Sem lista definida')).toBeInTheDocument();
    expect(screen.getByText('Fora de uso')).toBeInTheDocument();
  });

  it('omits groups that have no decks', () => {
    renderGroups([makeDeck(1, 'active', 'Active Deck')]);

    expect(screen.getByRole('heading', { name: 'Ativos', level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Construindo', level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ideias', level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Aposentados', level: 2 })).not.toBeInTheDocument();
  });

  it('renders a deckbox tile per deck', () => {
    renderGroups([makeDeck(1, 'active'), makeDeck(2, 'building')]);
    expect(screen.getAllByTestId('deckbox')).toHaveLength(2);
  });

  it('retired shelf starts collapsed by default', () => {
    const decks = [makeDeck(1, 'retired', 'My Retired Deck')];
    renderGroups(decks);

    // Deck name should not be visible when collapsed
    expect(screen.queryByText('My Retired Deck')).not.toBeInTheDocument();
  });

  it('clicking the retired chevron expands the shelf', () => {
    const decks = [makeDeck(1, 'retired', 'My Retired Deck')];
    renderGroups(decks);

    const toggle = screen.getByRole('button', { name: /expandir decks aposentados/i });
    fireEvent.click(toggle);

    expect(screen.getByText('My Retired Deck')).toBeInTheDocument();
  });

  it('clicking the retired chevron persists to localStorage', () => {
    const decks = [makeDeck(1, 'retired', 'My Retired Deck')];
    renderGroups(decks);

    const toggle = screen.getByRole('button', { name: /expandir decks aposentados/i });
    fireEvent.click(toggle);

    expect(localStorageMock['ra-shelf-retired-expanded']).toBe('true');
  });

  it('retired shelf reads expanded state from localStorage on mount', () => {
    localStorageMock['ra-shelf-retired-expanded'] = 'true';
    const decks = [makeDeck(1, 'retired', 'Persisted Deck')];
    renderGroups(decks);

    // Should start expanded because localStorage says true
    expect(screen.getByText('Persisted Deck')).toBeInTheDocument();
  });

  it('collapsed retired shelf toggles aria-expanded on the button', () => {
    const decks = [makeDeck(1, 'retired', 'Deck')];
    renderGroups(decks);

    const toggle = screen.getByRole('button', { name: /expandir decks aposentados/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('each shelf is a section with aria-labelledby pointing to its h2', () => {
    const decks = [
      makeDeck(1, 'active', 'Active Deck'),
      makeDeck(2, 'building', 'Building Deck'),
    ];
    renderGroups(decks);

    // Each rendered shelf should be a region with aria-labelledby → h2.
    // Filter to only shelf regions (those with aria-labelledby) since the
    // ToastProvider also mounts a region (viewport) without aria-labelledby.
    const sections = screen.getAllByRole('region');
    const shelfSections = sections.filter((s) => s.getAttribute('aria-labelledby') != null);
    expect(shelfSections.length).toBeGreaterThanOrEqual(2);
    shelfSections.forEach((section) => {
      const labelledById = section.getAttribute('aria-labelledby');
      expect(labelledById).toBeTruthy();
      if (labelledById) {
        const heading = document.getElementById(labelledById);
        expect(heading).toBeInTheDocument();
        expect(heading?.tagName).toBe('H2');
      }
    });
  });

  describe('all-retired empty state', () => {
    it('shows empty-state block when all decks are retired and shelf is collapsed', () => {
      const decks = [
        makeDeck(1, 'retired', 'Deck A'),
        makeDeck(2, 'retired', 'Deck B'),
      ];
      renderGroups(decks);

      expect(screen.getByText(/todos os seus decks estão aposentados/i)).toBeInTheDocument();
    });

    it('empty-state block has "Expand to view" button that expands the shelf', () => {
      const decks = [makeDeck(1, 'retired', 'Deck A')];
      renderGroups(decks);

      const expandBtn = screen.getByRole('button', { name: /expandir para ver/i });
      expect(expandBtn).toBeInTheDocument();
      fireEvent.click(expandBtn);
      expect(screen.getByText('Deck A')).toBeInTheDocument();
    });

    it('empty-state block has "Add new deck" link to /decks/new', () => {
      const decks = [makeDeck(1, 'retired', 'Deck A')];
      renderGroups(decks);

      const link = screen.getByRole('link', { name: /adicionar novo deck/i });
      expect(link).toHaveAttribute('href', '/decks/new');
    });

    it('empty-state block disappears when shelf is expanded', () => {
      const decks = [makeDeck(1, 'retired', 'Deck A')];
      renderGroups(decks);

      const toggle = screen.getByRole('button', { name: /expandir decks aposentados/i });
      fireEvent.click(toggle);

      expect(screen.queryByText(/todos os seus decks estão aposentados/i)).not.toBeInTheDocument();
    });

    it('does NOT render empty-state block when user has zero decks total', () => {
      renderGroups([], false);
      expect(screen.queryByText(/todos os seus decks estão aposentados/i)).not.toBeInTheDocument();
    });

    it('does NOT render empty-state block when some decks are non-retired', () => {
      const decks = [
        makeDeck(1, 'active', 'Active Deck'),
        makeDeck(2, 'retired', 'Retired Deck'),
      ];
      renderGroups(decks);

      expect(screen.queryByText(/todos os seus decks estão aposentados/i)).not.toBeInTheDocument();
    });
  });
});
