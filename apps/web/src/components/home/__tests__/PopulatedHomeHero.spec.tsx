import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PopulatedHomeHero } from '../PopulatedHomeHero';
import { ITrackedDeckListItem } from '../../../api/decks';

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
  effectivePercent: number,
  id = 1,
  status: ITrackedDeckListItem['status'] = 'building',
): ITrackedDeckListItem {
  return {
    id,
    fabraryUlid: `ulid-${id}`,
    name: `Deck ${id}`,
    hero: 'Rhinar',
    format: 'Classic Constructed',
    trackedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status,
    tags: [],
    legality: { category: 'legal', reasons: [] },
    latestSnapshot: {
      rawPercent: effectivePercent,
      effectivePercent,
      computedAt: '',
    },
    heroImageUrl: null,
    representativeCards: [],
  };
}

const THREE_DECKS = [makeDeck(90, 1), makeDeck(65, 2), makeDeck(30, 3)];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PopulatedHomeHero', () => {
  it('renders "Your Decks" heading', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} totalCardsMissing={null} />);
    expect(screen.getByRole('heading', { name: /your decks/i })).toBeInTheDocument();
  });

  it('renders deck count stat', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} totalCardsMissing={null} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Decks')).toBeInTheDocument();
  });

  it('renders average readiness stat', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} totalCardsMissing={null} />);
    // avg of 90, 65, 30 = 61.67, Math.round => 62
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText('Avg ready')).toBeInTheDocument();
  });

  it('renders cards missing stat with the same treatment as other stats', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} totalCardsMissing={42} />);
    const missingEl = screen.getByText('42');
    // Stat 3 reads as a uniform triplet with stats 1 & 2 — no primary
    // treatment class anymore.
    expect(missingEl).not.toHaveClass('ra-hero-primary-stat');
    expect(screen.getByText('Cards missing')).toBeInTheDocument();
  });

  it('does not render cards missing stat when totalCardsMissing is null', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} totalCardsMissing={null} />);
    expect(screen.queryByText('Cards missing')).not.toBeInTheDocument();
  });

  it('does not apply .ra-readiness-display to any hero stat number', () => {
    const { container } = render(
      <PopulatedHomeHero decks={THREE_DECKS} totalCardsMissing={42} />,
    );
    // .ra-readiness-display must NOT appear in the hero — it is reserved for deck cards
    const readinessDisplayEls = container.querySelectorAll('.ra-readiness-display');
    expect(readinessDisplayEls.length).toBe(0);
  });

  it('renders summary text reflecting tier counts', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} totalCardsMissing={null} />);
    expect(screen.getByText(/1 ready to play/i)).toBeInTheDocument();
    expect(screen.getByText(/1 almost there/i)).toBeInTheDocument();
    expect(screen.getByText(/1 to build/i)).toBeInTheDocument();
  });

  it('renders "--" avg readiness when no deck has a snapshot', () => {
    const noSnapshots: ITrackedDeckListItem[] = [
      { ...makeDeck(0), latestSnapshot: null },
    ];
    render(<PopulatedHomeHero decks={noSnapshots} totalCardsMissing={null} />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('renders "Add new deck" CTA linking to /decks/new (renamed from Track new deck per R44)', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} totalCardsMissing={null} />);
    const cta = screen.getByRole('link', { name: /add new deck/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/decks/new');
  });

  it('activeLibraryCount counts only non-retired decks', () => {
    const decks: ITrackedDeckListItem[] = [
      makeDeck(80, 1, 'active'),
      makeDeck(70, 2, 'building'),
      makeDeck(60, 3, 'retired'),
    ];
    render(<PopulatedHomeHero decks={decks} totalCardsMissing={null} />);
    // Only 2 non-retired decks → Decks stat = 2
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Decks')).toBeInTheDocument();
  });

  it('avgReadiness excludes retired decks from denominator', () => {
    const decks: ITrackedDeckListItem[] = [
      makeDeck(80, 1, 'active'),
      makeDeck(60, 2, 'building'),
      // This retired deck (100%) should NOT affect the avg
      makeDeck(100, 3, 'retired'),
    ];
    render(<PopulatedHomeHero decks={decks} totalCardsMissing={null} />);
    // avg of [80, 60] = 70%
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('does not render an "/import" link', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} totalCardsMissing={null} />);
    const links = screen.queryAllByRole('link');
    const importLinks = links.filter((l) => l.getAttribute('href')?.includes('/import'));
    expect(importLinks).toHaveLength(0);
  });
});
