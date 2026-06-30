import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StatusShelves } from '../StatusShelves';
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
    }: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
      className?: string;
    }) => {
      const href = params ? to.replace('$deckId', params.deckId ?? '') : to;
      return (
        <a href={href} className={className}>
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
  };
}

function renderShelves(
  decks: readonly ITrackedDeckListItem[],
  activeFilterTags: string[] = [],
  onUntrack = vi.fn(),
) {
  return render(
    <ToastProvider>
      <StatusShelves
        decks={decks}
        onUntrack={onUntrack}
        untrackingDeckId={null}
        activeFilterTags={activeFilterTags}
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

describe('StatusShelves', () => {
  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', localStorageStub);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders all 5 shelves when decks span all 5 statuses', () => {
    const decks = [
      makeDeck(1, 'active', 'Active Deck'),
      makeDeck(2, 'ready', 'Ready Deck'),
      makeDeck(3, 'building', 'Building Deck'),
      makeDeck(4, 'idea', 'Idea Deck'),
      makeDeck(5, 'retired', 'Retired Deck'),
    ];
    renderShelves(decks);

    // Use level: 2 to match only the shelf h2 headings, not status labels in DeckCard rows
    expect(screen.getByRole('heading', { name: /ativo/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pronto/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /construindo/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ideia/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /aposentado/i, level: 2 })).toBeInTheDocument();
  });

  it('skips empty status groups', () => {
    const decks = [makeDeck(1, 'active', 'Active Deck')];
    renderShelves(decks);

    // Use level: 2 to match only the shelf h2 headings
    expect(screen.getByRole('heading', { name: /ativo/i, level: 2 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /pronto/i, level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /construindo/i, level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /ideia/i, level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /aposentado/i, level: 2 })).not.toBeInTheDocument();
  });

  it('retired shelf starts collapsed by default', () => {
    const decks = [makeDeck(1, 'retired', 'My Retired Deck')];
    renderShelves(decks);

    // Deck name should not be visible when collapsed
    expect(screen.queryByText('My Retired Deck')).not.toBeInTheDocument();
  });

  it('clicking the retired chevron expands the shelf', () => {
    const decks = [makeDeck(1, 'retired', 'My Retired Deck')];
    renderShelves(decks);

    const toggle = screen.getByRole('button', { name: /expandir decks aposentados/i });
    fireEvent.click(toggle);

    expect(screen.getByText('My Retired Deck')).toBeInTheDocument();
  });

  it('clicking the retired chevron persists to localStorage', () => {
    const decks = [makeDeck(1, 'retired', 'My Retired Deck')];
    renderShelves(decks);

    const toggle = screen.getByRole('button', { name: /expandir decks aposentados/i });
    fireEvent.click(toggle);

    expect(localStorageMock['ra-shelf-retired-expanded']).toBe('true');
  });

  it('retired shelf reads expanded state from localStorage on mount', () => {
    localStorageMock['ra-shelf-retired-expanded'] = 'true';
    const decks = [makeDeck(1, 'retired', 'Persisted Deck')];
    renderShelves(decks);

    // Should start expanded because localStorage says true
    expect(screen.getByText('Persisted Deck')).toBeInTheDocument();
  });

  it('collapsed retired shelf toggles aria-expanded on the button', () => {
    const decks = [makeDeck(1, 'retired', 'Deck')];
    renderShelves(decks);

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
    renderShelves(decks);

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
      renderShelves(decks);

      expect(screen.getByText(/todos os seus decks estão aposentados/i)).toBeInTheDocument();
    });

    it('empty-state block has "Expand to view" button that expands the shelf', () => {
      const decks = [makeDeck(1, 'retired', 'Deck A')];
      renderShelves(decks);

      const expandBtn = screen.getByRole('button', { name: /expandir para ver/i });
      expect(expandBtn).toBeInTheDocument();
      fireEvent.click(expandBtn);
      expect(screen.getByText('Deck A')).toBeInTheDocument();
    });

    it('empty-state block has "Add new deck" link to /decks/new', () => {
      const decks = [makeDeck(1, 'retired', 'Deck A')];
      renderShelves(decks);

      const link = screen.getByRole('link', { name: /adicionar novo deck/i });
      expect(link).toHaveAttribute('href', '/decks/new');
    });

    it('empty-state block disappears when shelf is expanded', () => {
      const decks = [makeDeck(1, 'retired', 'Deck A')];
      renderShelves(decks);

      const toggle = screen.getByRole('button', { name: /expandir decks aposentados/i });
      fireEvent.click(toggle);

      expect(screen.queryByText(/todos os seus decks estão aposentados/i)).not.toBeInTheDocument();
    });

    it('does NOT render empty-state block when user has zero decks total', () => {
      renderShelves([]);
      expect(screen.queryByText(/todos os seus decks estão aposentados/i)).not.toBeInTheDocument();
    });

    it('does NOT render empty-state block when some decks are non-retired', () => {
      const decks = [
        makeDeck(1, 'active', 'Active Deck'),
        makeDeck(2, 'retired', 'Retired Deck'),
      ];
      renderShelves(decks);

      expect(screen.queryByText(/todos os seus decks estão aposentados/i)).not.toBeInTheDocument();
    });
  });

  describe('tag filter (OR logic)', () => {
    it('shows all decks when no tag filter is active', () => {
      const decks = [
        makeDeck(1, 'active', 'Deck A', ['league']),
        makeDeck(2, 'building', 'Deck B', ['casual']),
      ];
      renderShelves(decks);

      expect(screen.getByText('Deck A')).toBeInTheDocument();
      expect(screen.getByText('Deck B')).toBeInTheDocument();
    });

    it('filters shelves by active tag (OR logic)', () => {
      const decks = [
        makeDeck(1, 'active', 'Deck A', ['league']),
        makeDeck(2, 'active', 'Deck B', ['casual']),
        makeDeck(3, 'building', 'Deck C', ['league']),
      ];
      renderShelves(decks, ['league']);

      expect(screen.getByText('Deck A')).toBeInTheDocument();
      expect(screen.queryByText('Deck B')).not.toBeInTheDocument();
      expect(screen.getByText('Deck C')).toBeInTheDocument();
    });

    it('skips a shelf entirely when tag filter removes all its decks', () => {
      const decks = [
        makeDeck(1, 'active', 'Active Deck', ['league']),
        makeDeck(2, 'building', 'Building Deck', ['casual']),
      ];
      renderShelves(decks, ['league']);

      expect(screen.getByText('Active Deck')).toBeInTheDocument();
      // building shelf should be hidden (no casual deck matches 'league')
      expect(screen.queryByRole('heading', { name: /construindo/i })).not.toBeInTheDocument();
    });

    it('ORs two active filter tags', () => {
      const decks = [
        makeDeck(1, 'active', 'Deck A', ['league']),
        makeDeck(2, 'active', 'Deck B', ['casual']),
        makeDeck(3, 'active', 'Deck C', ['other']),
      ];
      renderShelves(decks, ['league', 'casual']);

      expect(screen.getByText('Deck A')).toBeInTheDocument();
      expect(screen.getByText('Deck B')).toBeInTheDocument();
      expect(screen.queryByText('Deck C')).not.toBeInTheDocument();
    });
  });
});
