/**
 * Unit tests for <ReadinessHero /> — Column A of deck detail (R7, R24)
 *
 * Test scenarios:
 *  - Renders deck name and hero/format meta tags
 *  - Renders percentage number with the correct value
 *  - Renders absolute count "X/Y cartas" in the label
 *  - Absolute count formats correctly for mid-values (36/60)
 *  - Absolute count is correct when provisionedCards = 0
 *  - Absolute count is correct when provisionedCards = totalCards (fully covered)
 *  - Fabrary link has correct href and opens in a new tab
 *  - Component renders without errors when effectivePercent is 0
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReadinessHero } from '../ReadinessHero';

// ---------------------------------------------------------------------------
// Shared fixture factory
// ---------------------------------------------------------------------------

interface IFixtureOverrides {
  readonly effectivePercent?: number;
  readonly rawPercent?: number;
  readonly fidelityPercent?: number;
  readonly fabraryUlid?: string;
  readonly deckName?: string;
  readonly hero?: string;
  readonly format?: string;
  readonly totalCards?: number;
  readonly provisionedCards?: number;
}

function renderHero(overrides: IFixtureOverrides = {}): void {
  render(
    <ReadinessHero
      effectivePercent={overrides.effectivePercent ?? 60.0}
      rawPercent={overrides.rawPercent ?? 55.0}
      fidelityPercent={overrides.fidelityPercent ?? 80.0}
      fabraryUlid={overrides.fabraryUlid ?? 'test-deck-ulid-001'}
      deckName={overrides.deckName ?? 'Kayo Blinding Blade'}
      hero={overrides.hero ?? 'Kayo'}
      format={overrides.format ?? 'Classic Constructed'}
      totalCards={overrides.totalCards ?? 60}
      provisionedCards={overrides.provisionedCards ?? 36}
    />,
  );
}

// ---------------------------------------------------------------------------
// Deck name and meta
// ---------------------------------------------------------------------------

describe('ReadinessHero — deck name and meta', () => {
  it('renders the deck name', () => {
    renderHero({ deckName: 'Kayo Blinding Blade' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kayo Blinding Blade');
  });

  it('renders the hero meta tag', () => {
    renderHero({ hero: 'Kayo' });
    expect(screen.getByText('Kayo')).toBeInTheDocument();
  });

  it('renders the format meta tag', () => {
    renderHero({ format: 'Classic Constructed' });
    expect(screen.getByText('Classic Constructed')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Percentage display
// ---------------------------------------------------------------------------

describe('ReadinessHero — percentage display', () => {
  it('renders the effective percent number', () => {
    renderHero({ effectivePercent: 60.0 });
    expect(screen.getByText('60.0')).toBeInTheDocument();
  });

  it('renders percent correctly when effectivePercent is 0', () => {
    renderHero({ effectivePercent: 0 });
    expect(screen.getByText('0.0')).toBeInTheDocument();
  });

  it('renders percent correctly when effectivePercent is 100', () => {
    renderHero({ effectivePercent: 100 });
    expect(screen.getByText('100.0')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Absolute count "X/Y cartas"
// ---------------------------------------------------------------------------

describe('ReadinessHero — absolute count display', () => {
  it('renders the absolute count for a mid-value case', () => {
    renderHero({ provisionedCards: 36, totalCards: 60 });
    expect(screen.getByText(/36\/60 cartas/)).toBeInTheDocument();
  });

  it('renders the absolute count when provisionedCards is 0', () => {
    renderHero({ provisionedCards: 0, totalCards: 60 });
    expect(screen.getByText(/0\/60 cartas/)).toBeInTheDocument();
  });

  it('renders the absolute count when fully covered (provisionedCards = totalCards)', () => {
    renderHero({ provisionedCards: 60, totalCards: 60 });
    expect(screen.getByText(/60\/60 cartas/)).toBeInTheDocument();
  });

  it('renders the absolute count with different deck sizes', () => {
    renderHero({ provisionedCards: 20, totalCards: 80 });
    expect(screen.getByText(/20\/80 cartas/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Fabrary link
// ---------------------------------------------------------------------------

describe('ReadinessHero — Fabrary link', () => {
  it('renders a link to Fabrary with the correct ULID', () => {
    renderHero({ fabraryUlid: 'abc123ulid' });
    const link = screen.getByRole('link', { name: /view on fabrary/i });
    expect(link).toHaveAttribute('href', 'https://fabrary.com/decks/abc123ulid');
  });

  it('opens the Fabrary link in a new tab', () => {
    renderHero({ fabraryUlid: 'abc123ulid' });
    const link = screen.getByRole('link', { name: /view on fabrary/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

// ---------------------------------------------------------------------------
// Raw / fidelity row
// ---------------------------------------------------------------------------

describe('ReadinessHero — raw/fidelity row', () => {
  it('renders the raw and fidelity percentages', () => {
    renderHero({ rawPercent: 55.0, fidelityPercent: 80.0 });
    expect(screen.getByText(/raw 55\.0%/i)).toBeInTheDocument();
    expect(screen.getByText(/fidelity 80\.0%/i)).toBeInTheDocument();
  });
});
