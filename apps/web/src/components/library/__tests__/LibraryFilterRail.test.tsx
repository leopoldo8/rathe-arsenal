/**
 * Tests for LibraryFilterRail — replaces the old LibraryFilters tests.
 * Covers the new control set: pitch pills, class/talent/set toggle rows
 * with counts, search-within input, snap-thresholds slider, clear-all.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LibraryFilterRail } from '../LibraryFilterRail';
import type { ILibraryFiltersValue } from '../LibraryFilterRail';
import type { ILibraryCard } from '../../../api/library';

const EMPTY_FILTERS: ILibraryFiltersValue = {
  pitches: [],
  types: [],
  classes: [],
  talents: [],
  sets: [],
  group: 'type',
  cardSize: 120,
};

function makeCard(overrides: Partial<ILibraryCard> = {}): ILibraryCard {
  return {
    cardIdentifier: 'WTR000',
    name: 'Test Card',
    pitch: null,
    types: ['attack'],
    classes: [],
    talents: [],
    sets: ['WTR'],
    imageUrl: null,
    ownedQuantity: 1,
    ...overrides,
  };
}

const SAMPLE_CARDS: readonly ILibraryCard[] = [
  makeCard({ cardIdentifier: 'WTR001', name: 'Hammer', pitch: 1, classes: ['Brute'], sets: ['WTR'] }),
  makeCard({ cardIdentifier: 'CRU001', name: 'Arrow', pitch: 2, classes: ['Ranger'], sets: ['CRU'], talents: ['Lightning'] }),
  makeCard({ cardIdentifier: 'CRU002', name: 'Shield', pitch: 3, classes: ['Guardian'], sets: ['CRU'] }),
];

function renderRail(props: Partial<React.ComponentProps<typeof LibraryFilterRail>> = {}) {
  const defaults: React.ComponentProps<typeof LibraryFilterRail> = {
    cards: SAMPLE_CARDS,
    value: EMPTY_FILTERS,
    onChange: vi.fn(),
    searchQuery: '',
    onSearchChange: vi.fn(),
    matchingCount: SAMPLE_CARDS.length,
  };
  return render(<LibraryFilterRail {...defaults} {...props} />);
}

describe('LibraryFilterRail — search input', () => {
  it('exposes a labeled search input', () => {
    renderRail();
    const input = screen.getByLabelText(/search the cards in your library by name/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'search');
  });

  it('emits onSearchChange when the user types', async () => {
    const onSearchChange = vi.fn();
    renderRail({ onSearchChange });
    const input = screen.getByLabelText(/search the cards/i);
    await userEvent.type(input, 'a');
    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  it('renders the matching chip with the matching count when search is at least 2 chars', () => {
    renderRail({ searchQuery: 'sh', matchingCount: 7 });
    expect(screen.getByText(/matching:/i)).toBeInTheDocument();
    // The count is rendered in a span inside the chip — scope by aria-live.
    const chip = screen.getByText(/matching:/i).closest('p');
    expect(chip).toHaveTextContent(/Matching:\s*7/i);
  });

  it('hides the matching chip below 2 chars', () => {
    renderRail({ searchQuery: 's' });
    expect(screen.queryByText(/matching:/i)).not.toBeInTheDocument();
  });
});

describe('LibraryFilterRail — pitch pills', () => {
  it('renders four pitch pills as toggle buttons', () => {
    renderRail();
    expect(screen.getByRole('checkbox', { name: /Red pitch/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Yellow pitch/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Blue pitch/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Colorless pitch/i })).toBeInTheDocument();
  });

  it('toggles the pitch in onChange when clicked', async () => {
    const onChange = vi.fn();
    renderRail({ onChange });
    await userEvent.click(screen.getByRole('checkbox', { name: /Red pitch/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pitches: ['red'] }),
    );
  });

  it('removes an already-selected pitch on click', async () => {
    const onChange = vi.fn();
    renderRail({
      value: { ...EMPTY_FILTERS, pitches: ['red'] },
      onChange,
    });
    await userEvent.click(screen.getByRole('checkbox', { name: /Red pitch/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pitches: [] }),
    );
  });
});

describe('LibraryFilterRail — class/talent/set toggle rows', () => {
  it('lists every class found in the loaded cards with its count', () => {
    renderRail();
    expect(screen.getByRole('checkbox', { name: /Brute/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Ranger/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Guardian/i })).toBeInTheDocument();
  });

  it('shows the empty hint when no cards carry talents', () => {
    renderRail({
      cards: [makeCard({ classes: ['Brute'] })],
    });
    expect(
      screen.getByText(/none of your cards carry a talent yet/i),
    ).toBeInTheDocument();
  });

  it('shows the empty hint when no cards carry classes', () => {
    renderRail({ cards: [makeCard({ classes: [] })] });
    expect(
      screen.getByText(/no classes in your collection yet/i),
    ).toBeInTheDocument();
  });

  it('emits onChange with the new selection when a row is toggled', async () => {
    const onChange = vi.fn();
    renderRail({ onChange });
    await userEvent.click(screen.getByRole('checkbox', { name: /Brute/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ classes: ['Brute'] }),
    );
  });
});

describe('LibraryFilterRail — card-size slider', () => {
  it('renders the slider with the current value', () => {
    renderRail({ value: { ...EMPTY_FILTERS, cardSize: 160 } });
    const slider = screen.getByRole('slider', { name: /card size in pixels/i });
    expect(slider).toHaveValue('160');
  });

  it('snaps onChange to a configured threshold when dragged', () => {
    const onChange = vi.fn();
    renderRail({ onChange });
    const slider = screen.getByRole('slider', { name: /card size in pixels/i });
    fireEvent.change(slider, { target: { value: '162' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ cardSize: 160 }),
    );
  });
});

describe('LibraryFilterRail — group-by segmented control', () => {
  it('renders all four group options as radios', () => {
    renderRail();
    expect(screen.getByRole('radio', { name: /^Type$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Pitch$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Set$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Flat$/ })).toBeInTheDocument();
  });

  it('marks the active group with aria-checked=true', () => {
    renderRail({ value: { ...EMPTY_FILTERS, group: 'pitch' } });
    expect(screen.getByRole('radio', { name: /^Pitch$/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /^Type$/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});

describe('LibraryFilterRail — clear all', () => {
  it('renders the clear-all button with the active filter count when filters exist', () => {
    renderRail({
      value: {
        ...EMPTY_FILTERS,
        pitches: ['red'],
        classes: ['Brute'],
      },
    });
    expect(screen.getByRole('button', { name: /clear all filters/i })).toBeInTheDocument();
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
  });

  it('hides the clear-all button when no filter is active', () => {
    renderRail();
    expect(
      screen.queryByRole('button', { name: /clear all filters/i }),
    ).not.toBeInTheDocument();
  });

  it('calls onChange and onSearchChange to clear everything', async () => {
    const onChange = vi.fn();
    const onSearchChange = vi.fn();
    renderRail({
      value: { ...EMPTY_FILTERS, pitches: ['red'] },
      searchQuery: 'sh',
      onChange,
      onSearchChange,
    });
    await userEvent.click(screen.getByRole('button', { name: /clear all/i }));
    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        pitches: [],
        classes: [],
        talents: [],
        sets: [],
      }),
    );
  });
});
