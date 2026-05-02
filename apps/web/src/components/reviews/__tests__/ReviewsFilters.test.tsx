/**
 * ReviewsFilters tests
 *
 * Covers:
 *  - Renders Tier, Confidence chips always visible
 *  - Deck chip appears when availableDecks is non-empty
 *  - Hero chip appears when availableHeroes is non-empty
 *  - Tier chip shows "(1, 2)" when tiers 1 and 2 are active
 *  - Clear button only appears when at least one filter is active
 *  - Clear button resets all filters to defaults
 *  - Clicking Clear shows count of active filters
 *
 * Note: Radix Popover content rendering in jsdom requires Portal; we verify
 * the trigger chips are rendered and the clear button responds correctly.
 * Deep Popover content tests would require a full jsdom environment setup
 * with Radix Popper — those are covered by Playwright E2E.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewsFilters } from '../ReviewsFilters';
import type { IReviewsFilters } from '../ReviewsFilters.helpers';
import { DEFAULT_FILTERS } from '../ReviewsFilters.helpers';

// ---- Helpers ----

const AVAILABLE_DECKS = [
  { id: '1', name: 'Dromai Storm' },
  { id: '2', name: 'Briar Build' },
];

const AVAILABLE_HEROES = ['Dromai', 'Briar'];

function renderFilters(
  filters: Partial<IReviewsFilters> = {},
  onChange = vi.fn(),
) {
  const merged: IReviewsFilters = { ...DEFAULT_FILTERS, ...filters };
  return {
    onChange,
    ...render(
      <ReviewsFilters
        filters={merged}
        availableDecks={AVAILABLE_DECKS}
        availableHeroes={AVAILABLE_HEROES}
        onChange={onChange}
      />,
    ),
  };
}

// ---- Tests ----

describe('ReviewsFilters — chip visibility', () => {
  it('renders the Tier filter chip', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Tier$/i })).toBeInTheDocument();
  });

  it('renders the Confidence filter chip', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Confidence$/i })).toBeInTheDocument();
  });

  it('renders the Deck filter chip when availableDecks is non-empty', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Deck$/i })).toBeInTheDocument();
  });

  it('renders the Hero filter chip when availableHeroes is non-empty', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Hero$/i })).toBeInTheDocument();
  });
});

describe('ReviewsFilters — active state labels', () => {
  it('Tier chip shows active tiers in label when tier filter is set', () => {
    renderFilters({ tier: [1, 2] });
    // Chip label should include the active tier values
    expect(screen.getByRole('button', { name: /Tier \(1, 2\)/i })).toBeInTheDocument();
  });

  it('Confidence chip shows range in label when confidence is not default', () => {
    renderFilters({ confidenceMin: 30, confidenceMax: 80 });
    expect(screen.getByRole('button', { name: /Confidence \(30–80\)/i })).toBeInTheDocument();
  });

  it('Deck chip shows count in label when deck filter is set', () => {
    renderFilters({ deck: ['1'] });
    expect(screen.getByRole('button', { name: /Deck \(1\)/i })).toBeInTheDocument();
  });

  it('Hero chip shows count in label when hero filter is set', () => {
    renderFilters({ hero: ['Dromai'] });
    expect(screen.getByRole('button', { name: /Hero \(1\)/i })).toBeInTheDocument();
  });
});

describe('ReviewsFilters — clear button', () => {
  it('does not render Clear button when all filters are default', () => {
    renderFilters();
    expect(screen.queryByRole('button', { name: /Clear/i })).not.toBeInTheDocument();
  });

  it('renders Clear button when tier filter is active', () => {
    renderFilters({ tier: [1] });
    expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument();
  });

  it('renders Clear button when confidence is non-default', () => {
    renderFilters({ confidenceMin: 20 });
    expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument();
  });

  it('Clear button shows active filter count', () => {
    // tier (1) + deck (1) = 2 active
    renderFilters({ tier: [1], deck: ['1'] });
    // The clear button's accessible name comes from its aria-label.
    expect(screen.getByRole('button', { name: /Clear all 2 active filters/i })).toBeInTheDocument();
  });

  it('clicking Clear calls onChange with DEFAULT_FILTERS', async () => {
    const onChange = vi.fn();
    renderFilters({ tier: [1, 3], deck: ['2'] }, onChange);
    await userEvent.click(screen.getByRole('button', { name: /Clear/i }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_FILTERS);
  });
});

describe('ReviewsFilters — aria-pressed', () => {
  it('Tier chip has aria-pressed=false when no tier selected', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Tier$/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('Tier chip has aria-pressed=true when tier is active', () => {
    renderFilters({ tier: [2] });
    expect(screen.getByRole('button', { name: /Tier \(2\)/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
