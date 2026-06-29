import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeckCard } from '../DeckCard';
import { ITrackedDeckListItem } from '../../../api/decks';

// ---------------------------------------------------------------------------
// Mock TanStack Router — Link renders as a plain <a> so tests don't need
// a full RouterProvider.
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

function makeDeck(overrides: Partial<ITrackedDeckListItem> = {}): ITrackedDeckListItem {
  return {
    id: 1,
    fabraryUlid: 'test-ulid',
    name: 'Test Deck',
    hero: 'Rhinar',
    format: 'Classic Constructed',
    trackedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'building',
    tags: [],
    legality: { category: 'legal', reasons: [] },
    latestSnapshot: {
      rawPercent: 85,
      effectivePercent: 85,
      computedAt: '2026-01-01T00:00:00Z',
    },
    heroImageUrl: null,
    representativeCards: [],
    ...overrides,
  };
}

function renderDeckCard(
  deck: ITrackedDeckListItem,
  onUntrack = vi.fn(),
  isUntracking = false,
) {
  return render(
    <DeckCard deck={deck} onUntrack={onUntrack} isUntracking={isUntracking} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckCard', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('renders deck name', () => {
    renderDeckCard(makeDeck({ name: 'Prism Spectral Shield' }));
    // Deck name appears twice: as the in-box label (visible) and as
    // the visually-hidden h3 (a11y outline).
    expect(screen.getAllByText('Prism Spectral Shield').length).toBeGreaterThanOrEqual(1);
  });

  it('renders hero and format', () => {
    renderDeckCard(makeDeck({ hero: 'Prism', format: 'Blitz' }));
    // Hero appears in the sr-only h3 title; format appears in the sr-only title
    // AND the new format pill — use getAllByText since both are in the DOM.
    expect(screen.getAllByText(/Prism/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Blitz/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders effectivePercent inside the wax seal with .ra-readiness-display class', () => {
    renderDeckCard(
      makeDeck({
        latestSnapshot: { rawPercent: 85, effectivePercent: 85, computedAt: '' },
      }),
    );
    // The wax seal rounds to integer (a quick-read stamp) and the
    // numeric SVG <text> keeps the brand's `.ra-readiness-display`
    // class so the brass Cinzel Decorative treatment carries over.
    const pctEl = screen.getByText('85');
    expect(pctEl).toHaveClass('ra-readiness-display');
  });

  it('exposes wax seal as a meter with the percent + tier in the label', () => {
    renderDeckCard(
      makeDeck({
        latestSnapshot: { rawPercent: 85, effectivePercent: 85, computedAt: '' },
      }),
    );
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '85');
    expect(meter).toHaveAttribute('aria-label', expect.stringMatching(/85%/));
  });

  it('renders "No readiness data yet" when snapshot is null', () => {
    renderDeckCard(makeDeck({ latestSnapshot: null }));
    expect(screen.getByText(/sem dados de prontidão/i)).toBeInTheDocument();
  });

  it('calls onUntrack with deck.id after confirm', () => {
    const onUntrack = vi.fn();
    renderDeckCard(makeDeck({ id: 42 }), onUntrack);
    const buttons = screen.getAllByRole('button', { name: /remover rastreamento/i });
    const firstButton = buttons[0];
    expect(firstButton).toBeDefined();
    fireEvent.click(firstButton!);
    expect(onUntrack).toHaveBeenCalledWith(42);
  });

  it('does not call onUntrack when confirm is cancelled', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const onUntrack = vi.fn();
    renderDeckCard(makeDeck());
    const buttons = screen.getAllByRole('button', { name: /remover rastreamento/i });
    const firstButton = buttons[0];
    expect(firstButton).toBeDefined();
    fireEvent.click(firstButton!);
    expect(onUntrack).not.toHaveBeenCalled();
  });

  it('shows loading state when isUntracking=true', () => {
    renderDeckCard(makeDeck(), vi.fn(), true);
    // The pin is icon-only, so the loading state is signalled by the
    // disabled attribute + aria-busy. The aria-label stays stable so
    // assistive tech still announces the deck name.
    const btn = screen.getByRole('button', { name: /remover rastreamento/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('the whole tile is a link to the deck detail (no explicit View CTA)', () => {
    renderDeckCard(makeDeck({ id: 7 }));
    const tileLink = screen.getByRole('link', { name: /test deck/i });
    expect(tileLink).toHaveAttribute('href', '/decks/7');
    // No standalone "View" button — clicking the deckbox is the action.
    expect(screen.queryByRole('link', { name: /^view/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^view/i })).not.toBeInTheDocument();
  });

  describe('(U9) status row', () => {
    it('renders the status label below the deck name', () => {
      renderDeckCard(makeDeck({ status: 'active' }));
      expect(screen.getByText('Ativo')).toBeInTheDocument();
    });

    it('renders different status labels for each status value', () => {
      const statuses: ITrackedDeckListItem['status'][] = [
        'idea', 'building', 'ready', 'active', 'retired',
      ];
      const expectedLabels = ['Ideia', 'Construindo', 'Pronto', 'Ativo', 'Aposentado'];
      statuses.forEach((status, i) => {
        const { unmount } = renderDeckCard(makeDeck({ status }));
        expect(screen.getByText(expectedLabels[i]!)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('(U9) tag chip soft cap', () => {
    it('shows all tags when deck has ≤4 tags', () => {
      renderDeckCard(makeDeck({ tags: ['a', 'b', 'c', 'd'] }));
      expect(screen.getByText('a')).toBeInTheDocument();
      expect(screen.getByText('b')).toBeInTheDocument();
      expect(screen.getByText('c')).toBeInTheDocument();
      expect(screen.getByText('d')).toBeInTheDocument();
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('shows 4 visible chips + "+N" overflow when deck has 6 tags', () => {
      renderDeckCard(makeDeck({ tags: ['a', 'b', 'c', 'd', 'e', 'f'] }));
      // 4 visible + +2 overflow
      expect(screen.getByText('a')).toBeInTheDocument();
      expect(screen.getByText('b')).toBeInTheDocument();
      expect(screen.getByText('c')).toBeInTheDocument();
      expect(screen.getByText('d')).toBeInTheDocument();
      expect(screen.queryByText('e')).not.toBeInTheDocument();
      expect(screen.queryByText('f')).not.toBeInTheDocument();
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('renders nothing when deck has no tags', () => {
      renderDeckCard(makeDeck({ tags: [] }));
      expect(screen.queryByLabelText('Tags')).not.toBeInTheDocument();
    });

    it('promotes active filter tags into the visible 4', () => {
      // Deck has 6 tags; 'liga local' is at position 6 (last)
      const deck = makeDeck({
        tags: ['a', 'b', 'c', 'd', 'e', 'liga local'],
      });
      // activeFilterTags = ['liga local'] — should be promoted to visible
      render(
        <DeckCard
          deck={deck}
          onUntrack={vi.fn()}
          isUntracking={false}
          activeFilterTags={['liga local']}
        />,
      );
      expect(screen.getByText('liga local')).toBeInTheDocument();
      // 'e' should be pushed out (liga local took a slot)
      expect(screen.queryByText('e')).not.toBeInTheDocument();
      // The overflow should show +2 (e and one of a-d pushed out)
      expect(screen.getByText('+2')).toBeInTheDocument();
    });
  });

  describe('(U9) legality icon', () => {
    it('renders ✓ when legality.category is "legal"', () => {
      renderDeckCard(makeDeck({ legality: { category: 'legal', reasons: [] } }));
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('renders ✗ when legality.category is "illegal"', () => {
      renderDeckCard(makeDeck({ legality: { category: 'illegal', reasons: ['Violation'] } }));
      expect(screen.getByText('✗')).toBeInTheDocument();
    });

    it('renders ✗ when legality.category is "incomplete"', () => {
      renderDeckCard(makeDeck({ legality: { category: 'incomplete', reasons: ['Missing hero'] } }));
      expect(screen.getByText('✗')).toBeInTheDocument();
    });
  });

  describe('(C3) deckbox vessel', () => {
    it('renders the hero image when heroImageUrl is provided', () => {
      const { container } = renderDeckCard(
        makeDeck({
          hero: 'Bravo, Star-Crossed',
          heroImageUrl: { small: 'https://lss.example/bravo-small.webp', smallSources: ['https://lss.example/bravo-small.webp'] },
        }),
      );
      const heroImg = container.querySelector('img[src*="bravo-small"]');
      expect(heroImg).toBeInTheDocument();
      expect(heroImg).toHaveAttribute('alt', 'Bravo, Star-Crossed');
    });

    it('falls back to a sigil placeholder when heroImageUrl is null', () => {
      const { container } = renderDeckCard(makeDeck({ heroImageUrl: null }));
      const heroImg = container.querySelector('img[alt="Rhinar"]');
      expect(heroImg).not.toBeInTheDocument();
      // The fallback renders a sigil glyph; presence proves the slot is rendered.
      expect(container.textContent).toContain('◆');
    });

    it('renders representative card images for the hover-open animation', () => {
      const { container } = renderDeckCard(
        makeDeck({
          representativeCards: [
            { cardIdentifier: 'pummel', name: 'Pummel', imageUrl: { small: 'https://lss.example/pummel.webp', smallSources: ['https://lss.example/pummel.webp'] } },
            { cardIdentifier: 'sigil', name: 'Sigil', imageUrl: { small: 'https://lss.example/sigil.webp', smallSources: ['https://lss.example/sigil.webp'] } },
            { cardIdentifier: 'romp', name: 'Romp', imageUrl: { small: 'https://lss.example/romp.webp', smallSources: ['https://lss.example/romp.webp'] } },
          ],
        }),
      );
      expect(container.querySelector('img[src*="pummel"]')).toBeInTheDocument();
      expect(container.querySelector('img[src*="sigil"]')).toBeInTheDocument();
      expect(container.querySelector('img[src*="romp"]')).toBeInTheDocument();
    });

    it('pads missing slots with silhouette fallbacks when fewer than 3 reps available', () => {
      const { container } = renderDeckCard(
        makeDeck({
          representativeCards: [
            { cardIdentifier: 'pummel', name: 'Pummel', imageUrl: { small: 'https://lss.example/pummel.webp', smallSources: ['https://lss.example/pummel.webp'] } },
          ],
        }),
      );
      // The single image slot renders, the other two slots fall back to silhouettes.
      expect(container.querySelector('img[src*="pummel"]')).toBeInTheDocument();
      // Silhouette renders a brass diamond crest. With one real card +
      // two silhouettes we expect 2 crest occurrences in the cards layer
      // plus 1 from the empty hero slot fallback if no hero image; here
      // hero is null so 3 total diamond glyphs.
      const diamondCount = (container.textContent?.match(/◆/g) ?? []).length;
      expect(diamondCount).toBeGreaterThanOrEqual(2);
    });
  });
});
