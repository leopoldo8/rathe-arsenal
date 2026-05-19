import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReadinessShelves } from '../ReadinessShelves';
import { ITrackedDeckListItem } from '../../../api/decks';

// ---------------------------------------------------------------------------
// Mock TanStack Router
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
  effectivePercent: number | null,
  name = `Deck ${id}`,
): ITrackedDeckListItem {
  return {
    id,
    fabraryUlid: `ulid-${id}`,
    name,
    hero: 'Rhinar',
    format: 'Classic Constructed',
    trackedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: 'building',
    tags: [],
    legality: { category: 'legal', reasons: [] },
    latestSnapshot:
      effectivePercent !== null
        ? { rawPercent: effectivePercent, effectivePercent, computedAt: '' }
        : null,
    heroImageUrl: null,
    representativeCards: [],
  };
}

const DECK_READY = makeDeck(1, 90, 'Ready Deck');
const DECK_ALMOST = makeDeck(2, 65, 'Almost Deck');
const DECK_NEEDS = makeDeck(3, 30, 'Needs Deck');
const DECK_NO_SNAPSHOT = makeDeck(4, null, 'No Snapshot Deck');

function renderShelves(
  decks: readonly ITrackedDeckListItem[],
  onUntrack = vi.fn(),
) {
  return render(
    <ReadinessShelves
      decks={decks}
      onUntrack={onUntrack}
      untrackingDeckId={null}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReadinessShelves', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  });

  it('renders all three shelves when decks span all tiers', () => {
    renderShelves([DECK_READY, DECK_ALMOST, DECK_NEEDS]);

    expect(screen.getByRole('heading', { name: /ready to play/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /almost there/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /needs collection/i })).toBeInTheDocument();
  });

  it('renders correct number of shelves when decks span all tiers', () => {
    renderShelves([DECK_READY, DECK_ALMOST, DECK_NEEDS]);

    const sections = screen.getAllByRole('region');
    expect(sections.length).toBe(3);
  });

  it('renders only "Ready to play" when all decks are ≥80%', () => {
    const allReady = [makeDeck(1, 80, 'A'), makeDeck(2, 95, 'B'), makeDeck(3, 100, 'C')];
    renderShelves(allReady);

    expect(screen.getByRole('heading', { name: /ready to play/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /almost there/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /needs collection/i }),
    ).not.toBeInTheDocument();
  });

  it('places null-snapshot decks in the Needs Collection shelf', () => {
    renderShelves([DECK_NO_SNAPSHOT]);

    expect(screen.getByRole('heading', { name: /needs collection/i })).toBeInTheDocument();
    expect(screen.getByText('No Snapshot Deck')).toBeInTheDocument();
  });

  it('places 50% deck in the Almost There shelf (boundary)', () => {
    renderShelves([makeDeck(1, 50)]);
    expect(screen.getByRole('heading', { name: /almost there/i })).toBeInTheDocument();
  });

  it('places 80% deck in Ready to Play shelf (boundary)', () => {
    renderShelves([makeDeck(1, 80)]);
    expect(screen.getByRole('heading', { name: /ready to play/i })).toBeInTheDocument();
  });

  it('each shelf is a section with aria-labelledby pointing to its h2', () => {
    renderShelves([DECK_READY, DECK_ALMOST]);

    const sections = screen.getAllByRole('region');
    sections.forEach((section) => {
      const labelledById = section.getAttribute('aria-labelledby');
      expect(labelledById).toBeTruthy();
      if (labelledById) {
        const heading = document.getElementById(labelledById);
        expect(heading).toBeInTheDocument();
        expect(heading?.tagName).toBe('H2');
      }
    });
  });

  it('renders deck name in each card', () => {
    renderShelves([DECK_READY, DECK_ALMOST, DECK_NEEDS]);

    expect(screen.getByText('Ready Deck')).toBeInTheDocument();
    expect(screen.getByText('Almost Deck')).toBeInTheDocument();
    expect(screen.getByText('Needs Deck')).toBeInTheDocument();
  });

  it('renders readiness percentage on cards', () => {
    renderShelves([DECK_READY]);
    // The wax seal renders the percent rounded to integer in an SVG
    // <text>, with the % sign in a sibling <text>. We assert the
    // semantic role exposes the value, which is the contract the rest
    // of the app + assistive tech reads.
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '90');
  });

  it('does not render empty shelves', () => {
    // Only one deck at 90% → only Ready shelf renders
    renderShelves([DECK_READY]);

    expect(
      screen.queryByRole('heading', { name: /almost there/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /needs collection/i }),
    ).not.toBeInTheDocument();
  });
});
