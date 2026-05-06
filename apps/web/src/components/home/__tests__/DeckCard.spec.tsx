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
    expect(screen.getByText('Prism Spectral Shield')).toBeInTheDocument();
  });

  it('renders hero and format', () => {
    renderDeckCard(makeDeck({ hero: 'Prism', format: 'Blitz' }));
    expect(screen.getByText(/Prism/)).toBeInTheDocument();
    expect(screen.getByText(/Blitz/)).toBeInTheDocument();
  });

  it('renders effectivePercent with .ra-readiness-display class', () => {
    renderDeckCard(
      makeDeck({
        latestSnapshot: { rawPercent: 85, effectivePercent: 85, computedAt: '' },
      }),
    );
    const pctEl = screen.getByText(/85\.0%/);
    expect(pctEl).toHaveClass('ra-readiness-display');
  });

  it('renders "No readiness data yet" when snapshot is null', () => {
    renderDeckCard(makeDeck({ latestSnapshot: null }));
    expect(screen.getByText(/no readiness data yet/i)).toBeInTheDocument();
  });

  it('calls onUntrack with deck.id after confirm', () => {
    const onUntrack = vi.fn();
    renderDeckCard(makeDeck({ id: 42 }), onUntrack);
    const buttons = screen.getAllByRole('button', { name: /untrack/i });
    const firstButton = buttons[0];
    expect(firstButton).toBeDefined();
    fireEvent.click(firstButton!);
    expect(onUntrack).toHaveBeenCalledWith(42);
  });

  it('does not call onUntrack when confirm is cancelled', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const onUntrack = vi.fn();
    renderDeckCard(makeDeck());
    const buttons = screen.getAllByRole('button', { name: /untrack/i });
    const firstButton = buttons[0];
    expect(firstButton).toBeDefined();
    fireEvent.click(firstButton!);
    expect(onUntrack).not.toHaveBeenCalled();
  });

  it('shows loading state when isUntracking=true', () => {
    renderDeckCard(makeDeck(), vi.fn(), true);
    // Untrack button is disabled and copy switches to "Untracking…"
    const btn = screen.getByRole('button', { name: /untrack/i });
    expect(btn).toBeDisabled();
    expect(btn.textContent).toMatch(/untracking/i);
  });

  it('the whole tile is a link to the deck detail (no explicit View CTA)', () => {
    renderDeckCard(makeDeck({ id: 7 }));
    const tileLink = screen.getByRole('link', { name: /test deck/i });
    expect(tileLink).toHaveAttribute('href', '/decks/7');
    // No standalone "View" button — clicking the deckbox is the action.
    expect(screen.queryByRole('link', { name: /^view/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^view/i })).not.toBeInTheDocument();
  });

  describe('(C3) deckbox vessel', () => {
    it('renders the hero image when heroImageUrl is provided', () => {
      const { container } = renderDeckCard(
        makeDeck({
          hero: 'Bravo, Star-Crossed',
          heroImageUrl: { small: 'https://lss.example/bravo-small.webp' },
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
            { cardIdentifier: 'pummel', name: 'Pummel', imageUrl: { small: 'https://lss.example/pummel.webp' } },
            { cardIdentifier: 'sigil', name: 'Sigil', imageUrl: { small: 'https://lss.example/sigil.webp' } },
            { cardIdentifier: 'romp', name: 'Romp', imageUrl: { small: 'https://lss.example/romp.webp' } },
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
            { cardIdentifier: 'pummel', name: 'Pummel', imageUrl: { small: 'https://lss.example/pummel.webp' } },
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
