/**
 * Tests for HeroDropdown component.
 *
 * Covers:
 *  - Search filter + emits cardIdentifier
 *  - No engine import (static check)
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeroDropdown } from '../HeroDropdown';

// ---------------------------------------------------------------------------
// Static import check
// ---------------------------------------------------------------------------

import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Mock useHeroesQuery
// ---------------------------------------------------------------------------

const MOCK_HEROES = [
  {
    cardIdentifier: 'katsu-the-wanderer-wtr',
    name: 'Katsu, the Wanderer',
    young: false,
    legalFormats: ['Classic Constructed', 'Blitz'],
    imageUrl: null,
  },
  {
    cardIdentifier: 'dorinthea-ironsong-wtr',
    name: 'Dorinthea Ironsong',
    young: false,
    legalFormats: ['Classic Constructed', 'Blitz'],
    imageUrl: null,
  },
  {
    cardIdentifier: 'briar-warbearer-evr',
    name: 'Briar, Warbearer',
    young: false,
    legalFormats: ['Classic Constructed'],
    imageUrl: null,
  },
];

vi.mock('../../../api/catalog', () => ({
  useHeroesQuery: () => ({
    data: { heroes: MOCK_HEROES },
    isLoading: false,
    isFetching: false,
  }),
  HEROES_QUERY_KEY: ['catalog-heroes'],
}));

// ---------------------------------------------------------------------------
// Static check
// ---------------------------------------------------------------------------

describe('HeroDropdown — no engine import (static check)', () => {
  it('does NOT have an import statement for @rathe-arsenal/engine', () => {
    const filePath = path.resolve(__dirname, '../HeroDropdown.tsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const importLines = content
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line));
    const hasEngineImport = importLines.some((line) =>
      line.includes('@rathe-arsenal/engine'),
    );
    expect(hasEngineImport).toBe(false);
  });

  it('does NOT have an import statement for @flesh-and-blood/cards', () => {
    const filePath = path.resolve(__dirname, '../HeroDropdown.tsx');
    const content = fs.readFileSync(filePath, 'utf8');
    const importLines = content
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line));
    const hasFabImport = importLines.some((line) =>
      line.includes('@flesh-and-blood/cards'),
    );
    expect(hasFabImport).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeroDropdown — basic rendering', () => {
  it('renders the input field', () => {
    render(<HeroDropdown value={null} onChange={() => undefined} />);
    expect(screen.getByTestId('hero-dropdown')).toBeInTheDocument();
    expect(screen.getByTestId('hero-dropdown-input')).toBeInTheDocument();
  });

  it('renders the label', () => {
    render(<HeroDropdown value={null} onChange={() => undefined} label="Hero" />);
    expect(screen.getByText('Hero')).toBeInTheDocument();
  });
});

describe('HeroDropdown — search filtering', () => {
  it('shows hero options when input is focused', async () => {
    render(<HeroDropdown value={null} onChange={() => undefined} />);
    const input = screen.getByTestId('hero-dropdown-input');
    await userEvent.click(input);
    expect(screen.getByTestId('hero-dropdown-listbox')).toBeInTheDocument();
  });

  it('filters heroes by name when typing', async () => {
    render(<HeroDropdown value={null} onChange={() => undefined} />);
    const input = screen.getByTestId('hero-dropdown-input');
    await userEvent.click(input);
    await userEvent.type(input, 'Kat');
    // Should show Katsu but not Dorinthea or Briar
    expect(screen.getByTestId('hero-option-katsu-the-wanderer-wtr')).toBeInTheDocument();
    expect(screen.queryByTestId('hero-option-dorinthea-ironsong-wtr')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hero-option-briar-warbearer-evr')).not.toBeInTheDocument();
  });

  it('shows "No heroes found" when filter yields nothing', async () => {
    render(<HeroDropdown value={null} onChange={() => undefined} />);
    const input = screen.getByTestId('hero-dropdown-input');
    await userEvent.click(input);
    await userEvent.type(input, 'zzznomatch');
    expect(screen.getByTestId('hero-dropdown-empty')).toBeInTheDocument();
  });
});

describe('HeroDropdown — selection emits cardIdentifier', () => {
  it('calls onChange with the hero cardIdentifier when option is clicked', async () => {
    const mockOnChange = vi.fn();
    render(<HeroDropdown value={null} onChange={mockOnChange} />);
    const input = screen.getByTestId('hero-dropdown-input');
    await userEvent.click(input);
    const option = screen.getByTestId('hero-option-dorinthea-ironsong-wtr');
    fireEvent.click(option);
    expect(mockOnChange).toHaveBeenCalledWith('dorinthea-ironsong-wtr');
  });

  it('closes the dropdown after selection', async () => {
    render(<HeroDropdown value={null} onChange={() => undefined} />);
    const input = screen.getByTestId('hero-dropdown-input');
    await userEvent.click(input);
    const option = screen.getByTestId('hero-option-katsu-the-wanderer-wtr');
    fireEvent.click(option);
    expect(screen.queryByTestId('hero-dropdown-listbox')).not.toBeInTheDocument();
  });
});

describe('HeroDropdown — selected state display', () => {
  it('shows the selected hero display when value is set', () => {
    render(
      <HeroDropdown value="katsu-the-wanderer-wtr" onChange={() => undefined} />,
    );
    expect(screen.getByTestId('hero-dropdown-selected')).toBeInTheDocument();
    expect(screen.getByText('Katsu, the Wanderer')).toBeInTheDocument();
  });

  it('shows clear button when a hero is selected', () => {
    render(
      <HeroDropdown value="katsu-the-wanderer-wtr" onChange={() => undefined} />,
    );
    expect(screen.getByTestId('hero-dropdown-clear')).toBeInTheDocument();
  });

  it('calls onChange with null when clear is clicked', async () => {
    const mockOnChange = vi.fn();
    render(
      <HeroDropdown value="katsu-the-wanderer-wtr" onChange={mockOnChange} />,
    );
    const clearBtn = screen.getByTestId('hero-dropdown-clear');
    await userEvent.click(clearBtn);
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });
});

describe('HeroDropdown — keyboard navigation', () => {
  it('allows Enter to select the highlighted hero', async () => {
    const mockOnChange = vi.fn();
    render(<HeroDropdown value={null} onChange={mockOnChange} />);
    const input = screen.getByTestId('hero-dropdown-input');
    await userEvent.click(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    // First hero should be selected (Katsu at index 0)
    expect(mockOnChange).toHaveBeenCalledWith('katsu-the-wanderer-wtr');
  });

  it('closes the dropdown on Escape', async () => {
    render(<HeroDropdown value={null} onChange={() => undefined} />);
    const input = screen.getByTestId('hero-dropdown-input');
    await userEvent.click(input);
    expect(screen.getByTestId('hero-dropdown-listbox')).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('hero-dropdown-listbox')).not.toBeInTheDocument();
  });
});
