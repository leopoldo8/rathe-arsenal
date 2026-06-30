/**
 * Unit tests for <DeckDetailSidebar /> (U11)
 *
 * Test scenarios:
 *  - Happy path: renders hero block with hero name.
 *  - Happy path: renders format pill.
 *  - Happy path: renders readiness block with effectivePercent.
 *  - Happy path: renders legality badge slot (data-testid present).
 *  - Happy path: fabrary link renders when fabraryUlid is non-null.
 *  - Happy path: fabrary link is absent when fabraryUlid is null (scratch deck).
 *  - Happy path: SidebarCollapseToggle renders at all widths.
 *  - Happy path: sidebar body is visible when expanded (default).
 *  - Happy path: clicking toggle collapses the sidebar body.
 *  - Happy path: clicking toggle again expands the sidebar body.
 *  - Edge case: heroIdentifier === null shows fallback hero name.
 *  - Edge case: legality.category = 'legal' → legality slot shows "✓ Legal".
 *  - Edge case: legality.category = 'incomplete' → legality slot shows "◌ Incomplete".
 *  - Edge case: legality.category = 'illegal' → legality slot shows "✗ Illegal".
 *  - a11y: sidebar has hero section and readiness section aria-labels.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeckDetailSidebar } from '../DeckDetailSidebar';
import type { IDeckLegality } from '../../../api/decks';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// ShoppingPanel — skip the complex shopping panel in unit tests
vi.mock('../ShoppingPanel', () => ({
  ShoppingPanel: () => <div data-testid="shopping-panel-mock" />,
}));

// useHeroesQuery hits useApiClient which requires <AuthProvider>; mock with
// a mutable holder so individual tests can seed catalog heroes. Defaults to
// empty so the sidebar falls through to the CardArt SVG placeholder.
const { heroesHolder } = vi.hoisted(() => ({
  heroesHolder: { heroes: [] as unknown[] },
}));

vi.mock('../../../api/catalog', () => ({
  useHeroesQuery: () => ({
    data: { heroes: heroesHolder.heroes },
    isLoading: false,
    isFetching: false,
  }),
}));

// SidebarCollapseToggle — use real component (it's simple)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  heroIdentifier: 'dorinthea-ironsong-wtr' as string | null,
  heroName: 'Dorinthea Ironsong' as string | null,
  heroLegacy: 'Dorinthea Ironsong',
  format: 'Classic Constructed',
  legality: { category: 'legal', reasons: [] as string[] } satisfies IDeckLegality,
  fabraryUlid: 'abc123ulid' as string | null,
  shoppingData: null,
  onFetchVariants: vi.fn(),
  fetchMutationStatus: 'idle' as const,
  isCooldownActive: false,
  onPollingChange: vi.fn(),
  onShoppingRetry: vi.fn(),
};

function renderSidebar(props: Partial<React.ComponentProps<typeof DeckDetailSidebar>> = {}) {
  return render(<DeckDetailSidebar {...defaultProps} {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckDetailSidebar — hero block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    heroesHolder.heroes = [];
  });

  it('prefers the resolved catalog hero name over heroLegacy (live edit follows heroIdentifier)', () => {
    // Simulates the route binding heroIdentifier to the live draft hero while
    // heroLegacy still carries the previously-saved name. The displayed name
    // must follow the catalog-resolved hero, not the stale legacy string.
    heroesHolder.heroes = [
      {
        cardIdentifier: 'kayo-berserker-runeblood',
        name: 'Kayo, Berserker',
        hero: 'Kayo',
        young: false,
        legalFormats: ['Classic Constructed'],
        imageUrl: null,
      },
    ];
    renderSidebar({
      heroIdentifier: 'kayo-berserker-runeblood',
      heroName: null,
      heroLegacy: 'Arakni', // stale saved name
    });
    expect(screen.getByTestId('sidebar-hero-name')).toHaveTextContent('Kayo, Berserker');
  });

  it('renders the hero name in the hero block', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar-hero-name')).toHaveTextContent('Dorinthea Ironsong');
  });

  it('renders the format pill', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar-format-pill')).toHaveTextContent('Classic Constructed');
  });

  it('renders the hero thumbnail placeholder', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar-hero-thumb')).toBeInTheDocument();
  });

  it('uses heroName when provided over heroLegacy', () => {
    renderSidebar({ heroName: 'Bravo, Star of the Show', heroLegacy: 'Bravo' });
    expect(screen.getByTestId('sidebar-hero-name')).toHaveTextContent('Bravo, Star of the Show');
  });

  it('falls back to heroLegacy when heroName is null', () => {
    renderSidebar({ heroName: null, heroLegacy: 'Dorinthea Ironsong' });
    expect(screen.getByTestId('sidebar-hero-name')).toHaveTextContent('Dorinthea Ironsong');
  });

  it('shows "No hero set" when heroIdentifier is null and heroLegacy is empty', () => {
    renderSidebar({ heroIdentifier: null, heroName: null, heroLegacy: '' });
    expect(screen.getByTestId('sidebar-hero-name')).toHaveTextContent('Sem herói definido');
  });
});

describe('DeckDetailSidebar — legality badge slot', () => {
  it('renders the legality slot data-testid anchor', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar-legality-slot')).toBeInTheDocument();
  });

  it('shows "✓ Legal" placeholder for legal decks', () => {
    renderSidebar({ legality: { category: 'legal', reasons: [] } });
    const slot = screen.getByTestId('sidebar-legality-slot');
    expect(slot).toHaveTextContent('Válido');
  });

  it('shows "◌ Incomplete" placeholder for incomplete decks', () => {
    renderSidebar({ legality: { category: 'incomplete', reasons: ['Missing hero'] } });
    const slot = screen.getByTestId('sidebar-legality-slot');
    expect(slot).toHaveTextContent('Incompleto');
  });

  it('shows "✗ Illegal" placeholder for illegal decks', () => {
    renderSidebar({ legality: { category: 'illegal', reasons: ['4× card exceeds limit'] } });
    const slot = screen.getByTestId('sidebar-legality-slot');
    expect(slot).toHaveTextContent('Ilegal');
  });

  it('has aria-label describing the legality category', () => {
    renderSidebar({ legality: { category: 'legal', reasons: [] } });
    expect(screen.getByTestId('sidebar-legality-slot')).toHaveAttribute(
      'aria-label',
      'Legalidade: legal',
    );
  });
});

describe('DeckDetailSidebar — fabrary link', () => {
  it('renders a fabrary link when fabraryUlid is non-null', () => {
    renderSidebar({ fabraryUlid: 'abc123' });
    const link = screen.getByTestId('sidebar-fabrary-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://fabrary.com/decks/abc123');
  });

  it('fabrary link opens in a new tab', () => {
    renderSidebar({ fabraryUlid: 'abc123' });
    expect(screen.getByTestId('sidebar-fabrary-link')).toHaveAttribute('target', '_blank');
  });

  it('does NOT render the fabrary link when fabraryUlid is null (scratch deck)', () => {
    renderSidebar({ fabraryUlid: null });
    expect(screen.queryByTestId('sidebar-fabrary-link')).not.toBeInTheDocument();
  });
});

// Updated per UXUI-14 AC2: the duplicate readiness block has been moved to
// ReadinessHero in the canvas. The sidebar MUST NOT render the readiness block.
describe('DeckDetailSidebar — readiness block removed (UXUI-14 AC2)', () => {
  it('does NOT render the sidebar readiness section (moved to ReadinessHero in canvas)', () => {
    renderSidebar();
    // AC2: duplicate readiness block SHALL be removed from DeckDetailSidebar
    expect(screen.queryByTestId('sidebar-readiness-section')).not.toBeInTheDocument();
  });

  it('does NOT render the sidebar readiness block data-testid', () => {
    renderSidebar();
    // AC2: the .ra-readiness-display signature is not shown twice at hero scale
    expect(screen.queryByTestId('sidebar-readiness-block')).not.toBeInTheDocument();
  });

  it('does NOT render a .ra-readiness-display element in the sidebar (R7 preserved)', () => {
    const { container } = renderSidebar();
    // AC4: .ra-readiness-display only appears once — exclusively in ReadinessHero (canvas)
    expect(container.querySelector('.ra-readiness-display')).toBeNull();
  });
});

describe('DeckDetailSidebar — collapse toggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sidebar body is visible by default (expanded)', () => {
    renderSidebar();
    expect(screen.getByTestId('deck-detail-sidebar-body')).toBeInTheDocument();
  });

  it('collapse toggle button is rendered', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar-collapse-toggle')).toBeInTheDocument();
  });

  it('clicking the toggle collapses the sidebar body', () => {
    renderSidebar();
    const toggle = screen.getByTestId('sidebar-collapse-toggle');
    // Starts expanded
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('clicking the toggle twice restores expanded state', () => {
    renderSidebar();
    const toggle = screen.getByTestId('sidebar-collapse-toggle');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('persists expanded state to localStorage', () => {
    renderSidebar();
    const toggle = screen.getByTestId('sidebar-collapse-toggle');
    fireEvent.click(toggle); // collapse
    expect(localStorage.getItem('ra-deck-sidebar-expanded')).toBe('false');
    fireEvent.click(toggle); // expand
    expect(localStorage.getItem('ra-deck-sidebar-expanded')).toBe('true');
  });

  it('reads initial state from localStorage (collapsed)', () => {
    // Set localStorage BEFORE rendering so the component initializes in collapsed state
    localStorage.setItem('ra-deck-sidebar-expanded', 'false');
    renderSidebar();
    expect(screen.getByTestId('sidebar-collapse-toggle')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('defaults to expanded when localStorage has no value', () => {
    // localStorage is already cleared in beforeEach
    renderSidebar();
    expect(screen.getByTestId('sidebar-collapse-toggle')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

describe('DeckDetailSidebar — shopping block', () => {
  it('renders the shopping panel', () => {
    renderSidebar();
    expect(screen.getByTestId('shopping-panel-mock')).toBeInTheDocument();
  });
});

describe('DeckDetailSidebar — a11y', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hero section has an accessible heading', () => {
    renderSidebar();
    // The sidebar has multiple section headings (hero title, Readiness, Shopping)
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
  });

  it('hero block section is aria-labelled by the hero-title heading', () => {
    renderSidebar();
    // The hero section uses aria-labelledby="sidebar-hero-title"
    // which points to the h2 heading element
    const heroSection = screen.getByRole('region', { name: 'Dorinthea Ironsong' });
    expect(heroSection).toBeInTheDocument();
  });

  it('fabrary link has an accessible label', () => {
    renderSidebar({ fabraryUlid: 'abc123' });
    expect(screen.getByRole('link', { name: /Fabrary/ })).toBeInTheDocument();
  });
});
