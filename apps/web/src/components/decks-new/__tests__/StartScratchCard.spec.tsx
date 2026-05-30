/**
 * Tests for StartScratchCard — hero/format gating.
 *
 * Focus: the "Start building" button must stay disabled (and the hero
 * field must surface an error) when the selected hero is not legal in the
 * selected format. FormatDropdown is stubbed to avoid Radix Select's
 * jsdom pointer-event quirks; HeroDropdown runs for real against a mocked
 * useHeroesQuery.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartScratchCard } from '../StartScratchCard';

const MOCK_HEROES = [
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

vi.mock('../../../api/decks', () => ({
  useCreateScratchDeckMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}));

// Stub FormatDropdown: render one button per format that calls onChange.
vi.mock('../../deck-detail/FormatDropdown', () => ({
  FormatDropdown: ({ onChange }: { onChange: (f: string) => void }) => (
    <div data-testid="format-stub">
      <button type="button" onClick={() => onChange('Silver Age')}>
        pick-silver-age
      </button>
      <button type="button" onClick={() => onChange('Classic Constructed')}>
        pick-cc
      </button>
    </div>
  ),
}));

async function selectBriar(): Promise<void> {
  const input = screen.getByTestId('hero-dropdown-input');
  await userEvent.click(input);
  fireEvent.click(screen.getByTestId('hero-option-briar-warbearer-evr'));
}

describe('StartScratchCard — hero/format gating', () => {
  it('keeps the button disabled until both hero and format are set', () => {
    render(<StartScratchCard />);
    expect(screen.getByTestId('start-building-btn')).toBeDisabled();
  });

  it('disables the button and shows an error when hero is illegal in the format', async () => {
    render(<StartScratchCard />);
    await selectBriar();
    fireEvent.click(screen.getByText('pick-silver-age'));

    expect(screen.getByTestId('start-building-btn')).toBeDisabled();
    expect(screen.getByTestId('hero-dropdown-format-error')).toBeInTheDocument();
  });

  it('enables the button and clears the error once a legal format is chosen', async () => {
    render(<StartScratchCard />);
    await selectBriar();
    fireEvent.click(screen.getByText('pick-silver-age'));
    expect(screen.getByTestId('start-building-btn')).toBeDisabled();

    fireEvent.click(screen.getByText('pick-cc'));

    expect(screen.getByTestId('start-building-btn')).not.toBeDisabled();
    expect(
      screen.queryByTestId('hero-dropdown-format-error'),
    ).not.toBeInTheDocument();
  });
});
