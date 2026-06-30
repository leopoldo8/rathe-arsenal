/**
 * i18n tests for /add-cards/manual pitch color labels (UXUI-08 / T14)
 *
 * Spec AC:
 *   WHEN add-cards manual renders a pitch color in an aria-label
 *   THEN the color name SHALL be localized.
 *
 * Test strategy: render AddCardsManualPage with mocked search results
 * (data always returned regardless of debounce), fire a change event on the
 * search input, advance fake timers past the debounce window, and assert
 * the pitch pip aria-label uses the pt-BR color name ("Vermelho"), not English.
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setTestLocale } from '../../../test/i18n-test-utils';

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE the module import
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({}),
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => <a href={to} className={className}>{children}</a>,
}));

const mockAddMutate = vi.fn();
vi.mock('../../../api/collection', () => ({
  useAddCardMutation: () => ({ mutate: mockAddMutate, isPending: false }),
}));

const mockSearchResult = {
  cardIdentifier: 'pummel-red',
  name: 'Pummel',
  pitch: 1 as const,
  classes: ['brute'],
  types: ['action'],
  ownedQuantity: 0,
  imageUrl: null,
  legalFormats: [],
  legalHeroes: [],
  bannedFormats: [],
};

vi.mock('../../../api/catalog', () => ({
  useSearchCardsQuery: () => ({
    data: { results: [mockSearchResult] },
    isSuccess: true,
    isFetching: false,
  }),
}));

vi.mock('../../../components/card-art/CardLightbox', () => ({
  CardLightbox: () => null,
}));

vi.mock('../../../components/card-art/CardArt', () => ({
  CardArt: () => <div data-testid="card-art-placeholder" />,
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { AddCardsManualPage } from '../add-cards.manual';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function typeQuery(query: string): void {
  const input = screen.getByRole('searchbox');
  fireEvent.change(input, { target: { value: query } });
}

function advanceDebounce(): void {
  act(() => {
    vi.advanceTimersByTime(300);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('add-cards.manual — pitch color i18n (T14 / UXUI-08)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders red pitch aria-label in Portuguese (Vermelho), not English (Red)', () => {
    // pt-BR is the default test locale
    render(<AddCardsManualPage />);
    typeQuery('pu');
    advanceDebounce();

    // Pitch pip aria-label should contain the Portuguese color name
    expect(screen.getByLabelText(/Vermelho/i)).toBeInTheDocument();
    // English "Red pitch" must not appear
    expect(screen.queryByLabelText(/Red pitch/i)).not.toBeInTheDocument();
  });

  it('renders red pitch aria-label in English under en-US', async () => {
    await setTestLocale('en-US');
    render(<AddCardsManualPage />);
    typeQuery('pu');
    advanceDebounce();

    // en-US "Red pitch" should appear
    expect(screen.getByLabelText(/Red pitch/i)).toBeInTheDocument();
    // Portuguese label must not appear
    expect(screen.queryByLabelText(/Vermelho/i)).not.toBeInTheDocument();
  });
});
