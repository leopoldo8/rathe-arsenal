import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PopulatedHomeHero } from '../PopulatedHomeHero';
import { ITrackedDeckListItem } from '../../../api/decks';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDeck(effectivePercent: number, id = 1): ITrackedDeckListItem {
  return {
    id,
    fabraryUlid: `ulid-${id}`,
    name: `Deck ${id}`,
    hero: 'Rhinar',
    format: 'Classic Constructed',
    trackedAt: '2026-01-01T00:00:00Z',
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
    render(<PopulatedHomeHero decks={THREE_DECKS} uniqueCardsMissing={null} />);
    expect(screen.getByRole('heading', { name: /your decks/i })).toBeInTheDocument();
  });

  it('renders deck count stat', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} uniqueCardsMissing={null} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Decks')).toBeInTheDocument();
  });

  it('renders average readiness stat', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} uniqueCardsMissing={null} />);
    // avg of 90, 65, 30 = 61.67, Math.round => 62
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText('Avg ready')).toBeInTheDocument();
  });

  it('renders cards missing stat with .ra-hero-primary-stat class when provided', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} uniqueCardsMissing={42} />);
    const missingEl = screen.getByText('42');
    expect(missingEl).toHaveClass('ra-hero-primary-stat');
    expect(screen.getByText('Cards missing')).toBeInTheDocument();
  });

  it('does not render cards missing stat when uniqueCardsMissing is null', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} uniqueCardsMissing={null} />);
    expect(screen.queryByText('Cards missing')).not.toBeInTheDocument();
  });

  it('does not apply .ra-readiness-display to any hero stat number', () => {
    const { container } = render(
      <PopulatedHomeHero decks={THREE_DECKS} uniqueCardsMissing={42} />,
    );
    // .ra-readiness-display must NOT appear in the hero — it is reserved for deck cards
    const readinessDisplayEls = container.querySelectorAll('.ra-readiness-display');
    expect(readinessDisplayEls.length).toBe(0);
  });

  it('renders summary text reflecting tier counts', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} uniqueCardsMissing={null} />);
    expect(screen.getByText(/1 ready to play/i)).toBeInTheDocument();
    expect(screen.getByText(/1 almost there/i)).toBeInTheDocument();
    expect(screen.getByText(/1 to build/i)).toBeInTheDocument();
  });

  it('renders "--" avg readiness when no deck has a snapshot', () => {
    const noSnapshots: ITrackedDeckListItem[] = [
      { ...makeDeck(0), latestSnapshot: null },
    ];
    render(<PopulatedHomeHero decks={noSnapshots} uniqueCardsMissing={null} />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('renders "Track new deck" CTA linking to /decks/new', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} uniqueCardsMissing={null} />);
    const cta = screen.getByRole('link', { name: /track new deck/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute('href', '/decks/new');
  });

  it('does not render an "/import" link', () => {
    render(<PopulatedHomeHero decks={THREE_DECKS} uniqueCardsMissing={null} />);
    const links = screen.queryAllByRole('link');
    const importLinks = links.filter((l) => l.getAttribute('href')?.includes('/import'));
    expect(importLinks).toHaveLength(0);
  });
});
