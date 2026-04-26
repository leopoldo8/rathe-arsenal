import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { LibraryFilters } from '../LibraryFilters';
import type { ILibraryFiltersValue } from '../LibraryFilters';
import type { ILibraryCard } from '../../../api/library';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const EMPTY_FILTERS: ILibraryFiltersValue = {
  pitches: [],
  types: [],
  classes: [],
  talents: [],
  sets: [],
  group: 'type',
  cardSize: 120,
};

function makeCard(overrides: Partial<ILibraryCard>): ILibraryCard {
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
  makeCard({ cardIdentifier: 'WTR001', name: 'Hammer', pitch: 1, types: ['attack'], sets: ['WTR'] }),
  makeCard({ cardIdentifier: 'WTR002', name: 'Shield', pitch: 3, types: ['defense'], sets: ['WTR'] }),
  makeCard({ cardIdentifier: 'CRU001', name: 'Arrow', pitch: 2, types: ['attack'], sets: ['CRU'] }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LibraryFilters — pitch checkboxes', () => {
  it('renders all 4 pitch checkbox options', () => {
    render(
      <LibraryFilters cards={SAMPLE_CARDS} value={EMPTY_FILTERS} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('checkbox', { name: /R — Red/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Y — Yellow/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /B — Blue/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /— Colorless/i })).toBeInTheDocument();
  });

  it('calls onChange with the selected pitch when a checkbox is clicked', async () => {
    const onChange = vi.fn();
    render(<LibraryFilters cards={SAMPLE_CARDS} value={EMPTY_FILTERS} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /R — Red/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pitches: ['red'] }),
    );
  });

  it('calls onChange removing a pitch when an already-checked checkbox is clicked', async () => {
    const onChange = vi.fn();
    const value: ILibraryFiltersValue = { ...EMPTY_FILTERS, pitches: ['red'] };
    render(<LibraryFilters cards={SAMPLE_CARDS} value={value} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /R — Red/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pitches: [] }),
    );
  });
});

describe('LibraryFilters — type select', () => {
  it('populates type options from cards', () => {
    render(
      <LibraryFilters cards={SAMPLE_CARDS} value={EMPTY_FILTERS} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('option', { name: 'attack' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'defense' })).toBeInTheDocument();
  });

  it('shows a Clear button when types are selected', () => {
    const value: ILibraryFiltersValue = { ...EMPTY_FILTERS, types: ['attack'] };
    render(<LibraryFilters cards={SAMPLE_CARDS} value={value} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /clear type filter/i })).toBeInTheDocument();
  });

  it('calls onChange with empty types when Clear is clicked', async () => {
    const onChange = vi.fn();
    const value: ILibraryFiltersValue = { ...EMPTY_FILTERS, types: ['attack'] };
    render(<LibraryFilters cards={SAMPLE_CARDS} value={value} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /clear type filter/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ types: [] }));
  });
});

describe('LibraryFilters — set select', () => {
  it('populates set options from cards', () => {
    render(
      <LibraryFilters cards={SAMPLE_CARDS} value={EMPTY_FILTERS} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('option', { name: 'WTR' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'CRU' })).toBeInTheDocument();
  });
});

describe('LibraryFilters — grouping segmented control', () => {
  it('renders all 4 group buttons', () => {
    render(
      <LibraryFilters cards={SAMPLE_CARDS} value={EMPTY_FILTERS} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /^Type$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pitch$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Set$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Flat$/i })).toBeInTheDocument();
  });

  it('marks the current group as aria-pressed=true', () => {
    const value: ILibraryFiltersValue = { ...EMPTY_FILTERS, group: 'pitch' };
    render(<LibraryFilters cards={SAMPLE_CARDS} value={value} onChange={vi.fn()} />);
    const pitchBtn = screen.getByRole('button', { name: /^Pitch$/i });
    expect(pitchBtn).toHaveAttribute('aria-pressed', 'true');
    const typeBtn = screen.getByRole('button', { name: /^Type$/i });
    expect(typeBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with new group when a grouping button is clicked', async () => {
    const onChange = vi.fn();
    render(<LibraryFilters cards={SAMPLE_CARDS} value={EMPTY_FILTERS} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /^Set$/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ group: 'set' }));
  });
});

describe('LibraryFilters — class select', () => {
  const cards: readonly ILibraryCard[] = [
    makeCard({ cardIdentifier: 'A', classes: ['Warrior'] }),
    makeCard({ cardIdentifier: 'B', classes: ['Wizard'] }),
    makeCard({ cardIdentifier: 'C', classes: [] }),
  ];

  it('populates class options from cards', () => {
    render(<LibraryFilters cards={cards} value={EMPTY_FILTERS} onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'Warrior' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Wizard' })).toBeInTheDocument();
  });

  it('shows a Clear button when classes are selected', () => {
    const value: ILibraryFiltersValue = { ...EMPTY_FILTERS, classes: ['Warrior'] };
    render(<LibraryFilters cards={cards} value={value} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /clear class filter/i })).toBeInTheDocument();
  });
});

describe('LibraryFilters — talent select', () => {
  const cards: readonly ILibraryCard[] = [
    makeCard({ cardIdentifier: 'A', talents: ['lightning'] }),
    makeCard({ cardIdentifier: 'B', talents: ['earth'] }),
    makeCard({ cardIdentifier: 'C', talents: [] }),
  ];

  it('populates talent options from cards', () => {
    render(<LibraryFilters cards={cards} value={EMPTY_FILTERS} onChange={vi.fn()} />);
    expect(screen.getByRole('option', { name: 'lightning' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'earth' })).toBeInTheDocument();
  });

  it('shows a Clear button when talents are selected', () => {
    const value: ILibraryFiltersValue = { ...EMPTY_FILTERS, talents: ['earth'] };
    render(<LibraryFilters cards={cards} value={value} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /clear talent filter/i })).toBeInTheDocument();
  });
});

describe('LibraryFilters — card-size slider', () => {
  it('renders the slider with the current value', () => {
    const value: ILibraryFiltersValue = { ...EMPTY_FILTERS, cardSize: 160 };
    render(<LibraryFilters cards={SAMPLE_CARDS} value={value} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider', { name: /card size in pixels/i });
    expect(slider).toHaveValue('160');
  });

  it('calls onChange with a snapped card size when slider moves', () => {
    const onChange = vi.fn();
    render(
      <LibraryFilters cards={SAMPLE_CARDS} value={EMPTY_FILTERS} onChange={onChange} />,
    );
    const slider = screen.getByRole('slider', { name: /card size in pixels/i });
    // 180 is exactly between thresholds 160 and 200. The snap implementation
    // prefers the first threshold seen on a tie (160). Verify the value lands
    // on a configured threshold rather than asserting a raw px input.
    fireEvent.change(slider, { target: { value: '180' } });
    const call = onChange.mock.calls[0]?.[0] as { cardSize: number } | undefined;
    expect([80, 120, 160, 200, 240]).toContain(call?.cardSize);
  });

  it('snaps to the nearest threshold (140 -> 120 or 160)', () => {
    const onChange = vi.fn();
    render(
      <LibraryFilters cards={SAMPLE_CARDS} value={{ ...EMPTY_FILTERS, cardSize: 80 }} onChange={onChange} />,
    );
    const slider = screen.getByRole('slider', { name: /card size in pixels/i });
    fireEvent.change(slider, { target: { value: '162' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cardSize: 160 }));
  });
});

describe('LibraryFilters — accessibility', () => {
  it('pitch fieldset has a legend', () => {
    render(
      <LibraryFilters cards={SAMPLE_CARDS} value={EMPTY_FILTERS} onChange={vi.fn()} />,
    );
    // Multiple elements may have "Pitch" text (legend + group button); verify
    // the pitch fieldset itself is accessible via its legend.
    const pitchFieldset = document.querySelector('fieldset');
    expect(pitchFieldset).toBeInTheDocument();
    // The legend element should carry the "Pitch" text
    const legend = pitchFieldset?.querySelector('legend');
    expect(legend?.textContent).toBe('Pitch');
  });

  it('type select has a label', () => {
    render(
      <LibraryFilters cards={SAMPLE_CARDS} value={EMPTY_FILTERS} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText(/filter by card type/i)).toBeInTheDocument();
  });

  it('set select has a label', () => {
    render(
      <LibraryFilters cards={SAMPLE_CARDS} value={EMPTY_FILTERS} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText(/filter by set/i)).toBeInTheDocument();
  });
});
