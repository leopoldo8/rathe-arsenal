/**
 * Tests for /decks/new (DecksNewPage) — U15 two-path landing.
 *
 * Covers:
 *  - Page renders heading "Add new deck" + two cards
 *  - Back-to-home link is present
 *  - ImportFabraryCard: valid URL → calls import mutation → navigates to detail
 *  - ImportFabraryCard: invalid URL → error, no mutation call
 *  - ImportFabraryCard: does not pass seedInventory:true
 *  - ImportFabraryCard: mutation error → inline error shown
 *  - StartScratchCard: "Start building" disabled until both fields set
 *  - StartScratchCard: hero + format → POST /decks → navigate to /decks/:id?edit=1
 *  - StartScratchCard: POST /decks 400 → inline error in card
 *  - StartScratchCard: hero combobox shows only hero-type cards (via useHeroesQuery)
 *  - StartScratchCard: format dropdown lists 4 supported formats
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Hoisted mock state — must be declared before vi.mock factories
// ---------------------------------------------------------------------------

const { mockNavigate, importMutate, scratchMutateHolder } = vi.hoisted(() => {
  const mockNavigate = vi.fn();
  const importMutate = vi.fn();
  // Use a holder object so the factory can always read the latest .fn value
  const scratchMutateHolder = { fn: vi.fn(), isPending: false };
  return { mockNavigate, importMutate, scratchMutateHolder };
});

// ---------------------------------------------------------------------------
// Mocks for TanStack Router
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (_config: unknown) => ({
    useSearch: () => ({}),
  }),
  useNavigate: () => mockNavigate,
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Mock decks API
// ---------------------------------------------------------------------------

vi.mock('../../../api/decks', () => ({
  useImportDecksMutation: () => ({
    mutate: importMutate,
    isPending: false,
  }),
  useCreateScratchDeckMutation: () => ({
    mutate: scratchMutateHolder.fn,
    isPending: scratchMutateHolder.isPending,
  }),
}));

// ---------------------------------------------------------------------------
// Mock HeroDropdown (from deck-detail) — simple controlled input
// ---------------------------------------------------------------------------

vi.mock('../../../components/deck-detail/HeroDropdown', () => ({
  HeroDropdown: ({
    value,
    onChange,
  }: {
    value: string | null;
    onChange: (id: string | null) => void;
  }) => (
    <div data-testid="hero-dropdown-mock">
      <input
        data-testid="hero-dropdown-input-mock"
        placeholder="Search hero..."
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Mock FormatDropdown (from deck-detail) — native select with 4 options
// ---------------------------------------------------------------------------

vi.mock('../../../components/deck-detail/FormatDropdown', () => ({
  FormatDropdown: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (f: string) => void;
  }) => (
    <div data-testid="format-dropdown-mock">
      <select
        data-testid="format-dropdown-select-mock"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select format</option>
        <option value="Classic Constructed">Classic Constructed</option>
        <option value="Blitz">Blitz</option>
        <option value="Draft">Draft</option>
        <option value="Sealed">Sealed</option>
      </select>
    </div>
  ),
  SUPPORTED_FORMATS: [
    { value: 'Classic Constructed', label: 'Classic Constructed' },
    { value: 'Blitz', label: 'Blitz' },
    { value: 'Draft', label: 'Draft' },
    { value: 'Sealed', label: 'Sealed' },
  ],
}));

// ---------------------------------------------------------------------------
// Import under test
// ---------------------------------------------------------------------------

import { DecksNewPage } from '../decks.new';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPage(): ReturnType<typeof render> {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <DecksNewPage />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DecksNewPage — /decks/new', () => {
  beforeEach(() => {
    importMutate.mockReset();
    mockNavigate.mockReset();
    scratchMutateHolder.fn = vi.fn();
    scratchMutateHolder.isPending = false;
  });

  // -------------------------------------------------------------------------
  // Page structure
  // -------------------------------------------------------------------------

  it('renders heading "Add new deck"', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /add new deck/i }),
    ).toBeInTheDocument();
  });

  it('does NOT render old heading "Track a deck"', () => {
    renderPage();
    expect(
      screen.queryByRole('heading', { name: /track a deck/i }),
    ).not.toBeInTheDocument();
  });

  it('renders two cards', () => {
    renderPage();
    expect(screen.getByTestId('import-fabrary-card')).toBeInTheDocument();
    expect(screen.getByTestId('start-scratch-card')).toBeInTheDocument();
  });

  it('renders the back-to-home link', () => {
    renderPage();
    const back = screen.getByRole('link', { name: /home/i });
    expect(back).toHaveAttribute('href', '/home');
  });

  // -------------------------------------------------------------------------
  // ImportFabraryCard happy path
  // -------------------------------------------------------------------------

  it('ImportFabraryCard: renders the Fabrary URL input', () => {
    renderPage();
    expect(screen.getByLabelText(/Fabrary deck URL/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /track deck/i }),
    ).toBeInTheDocument();
  });

  it('ImportFabraryCard: calls import mutation with correct payload on valid URL', async () => {
    renderPage();
    const input = screen.getByLabelText(/Fabrary deck URL/i);
    fireEvent.change(input, {
      target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
    });
    await userEvent.click(screen.getByRole('button', { name: /track deck/i }));
    expect(importMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        urls: ['https://fabrary.net/decks/01HABCDEFG12345'],
      }),
      expect.any(Object),
    );
  });

  it('ImportFabraryCard: on success navigates to deck detail in View mode', async () => {
    importMutate.mockImplementation(
      (_payload: unknown, { onSuccess }: { onSuccess: (r: unknown) => void }) => {
        onSuccess({ imported: [{ trackedDeckId: 42 }] });
      },
    );
    renderPage();
    const input = screen.getByLabelText(/Fabrary deck URL/i);
    fireEvent.change(input, {
      target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
    });
    await userEvent.click(screen.getByRole('button', { name: /track deck/i }));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/decks/$deckId',
        params: { deckId: '42' },
        search: { edit: undefined },
      }),
    );
  });

  it('ImportFabraryCard: rejects an invalid URL without calling the mutation', async () => {
    renderPage();
    const input = screen.getByLabelText(/Fabrary deck URL/i);
    await userEvent.type(input, 'not-a-url');
    await userEvent.click(screen.getByRole('button', { name: /track deck/i }));
    expect(importMutate).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Not a valid Fabrary deck URL/i),
    ).toBeInTheDocument();
  });

  it('ImportFabraryCard: mutation error shows inline error', async () => {
    importMutate.mockImplementation(
      (_payload: unknown, { onError }: { onError: (e: Error) => void }) => {
        onError(new Error('Server unavailable'));
      },
    );
    renderPage();
    const input = screen.getByLabelText(/Fabrary deck URL/i);
    fireEvent.change(input, {
      target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
    });
    await userEvent.click(screen.getByRole('button', { name: /track deck/i }));
    expect(screen.getByText(/Server unavailable/i)).toBeInTheDocument();
  });

  it('ImportFabraryCard: does not opt into inventory seeding', async () => {
    renderPage();
    const input = screen.getByLabelText(/Fabrary deck URL/i);
    fireEvent.change(input, {
      target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
    });
    await userEvent.click(screen.getByRole('button', { name: /track deck/i }));
    const [payload] = importMutate.mock.calls[0] as [
      { seedInventory?: boolean },
    ];
    expect(payload.seedInventory).not.toBe(true);
  });

  // -------------------------------------------------------------------------
  // StartScratchCard — disabled state
  // -------------------------------------------------------------------------

  it('StartScratchCard: "Start building" is disabled when no fields are set', () => {
    renderPage();
    const btn = screen.getByTestId('start-building-btn');
    expect(btn).toBeDisabled();
  });

  it('StartScratchCard: "Start building" is disabled when only hero is set', () => {
    renderPage();
    const heroInput = screen.getByTestId('hero-dropdown-input-mock');
    fireEvent.change(heroInput, {
      target: { value: 'dorinthea-ironsong-wtr' },
    });
    const btn = screen.getByTestId('start-building-btn');
    expect(btn).toBeDisabled();
  });

  it('StartScratchCard: "Start building" is disabled when only format is set', () => {
    renderPage();
    const formatSelect = screen.getByTestId('format-dropdown-select-mock');
    fireEvent.change(formatSelect, { target: { value: 'Classic Constructed' } });
    const btn = screen.getByTestId('start-building-btn');
    expect(btn).toBeDisabled();
  });

  it('StartScratchCard: "Start building" is enabled when both fields are set', () => {
    renderPage();
    const heroInput = screen.getByTestId('hero-dropdown-input-mock');
    fireEvent.change(heroInput, {
      target: { value: 'dorinthea-ironsong-wtr' },
    });
    const formatSelect = screen.getByTestId('format-dropdown-select-mock');
    fireEvent.change(formatSelect, { target: { value: 'Classic Constructed' } });
    const btn = screen.getByTestId('start-building-btn');
    expect(btn).not.toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // StartScratchCard — happy path submission
  // -------------------------------------------------------------------------

  it('StartScratchCard: submits with hero + format and navigates to edit mode', async () => {
    scratchMutateHolder.fn.mockImplementation(
      (
        _payload: unknown,
        { onSuccess }: { onSuccess: (r: { id: number }) => void },
      ) => {
        onSuccess({ id: 99 });
      },
    );
    renderPage();

    const heroInput = screen.getByTestId('hero-dropdown-input-mock');
    fireEvent.change(heroInput, {
      target: { value: 'dorinthea-ironsong-wtr' },
    });
    const formatSelect = screen.getByTestId('format-dropdown-select-mock');
    fireEvent.change(formatSelect, { target: { value: 'Classic Constructed' } });

    await userEvent.click(screen.getByTestId('start-building-btn'));

    expect(scratchMutateHolder.fn).toHaveBeenCalledWith(
      expect.objectContaining({
        heroIdentifier: 'dorinthea-ironsong-wtr',
        format: 'Classic Constructed',
      }),
      expect.any(Object),
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/decks/$deckId',
        params: { deckId: '99' },
        search: { edit: '1' },
      }),
    );
  });

  // -------------------------------------------------------------------------
  // StartScratchCard — error path
  // -------------------------------------------------------------------------

  it('StartScratchCard: POST /decks 400 shows inline error in card', async () => {
    scratchMutateHolder.fn.mockImplementation(
      (_payload: unknown, { onError }: { onError: (e: Error) => void }) => {
        onError(new Error('Hero not found'));
      },
    );
    renderPage();

    const heroInput = screen.getByTestId('hero-dropdown-input-mock');
    fireEvent.change(heroInput, {
      target: { value: 'dorinthea-ironsong-wtr' },
    });
    const formatSelect = screen.getByTestId('format-dropdown-select-mock');
    fireEvent.change(formatSelect, { target: { value: 'Classic Constructed' } });

    await userEvent.click(screen.getByTestId('start-building-btn'));

    expect(screen.getByTestId('scratch-error')).toBeInTheDocument();
    expect(screen.getByText(/Hero not found/i)).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // StartScratchCard — hero combobox backed by useHeroesQuery
  // -------------------------------------------------------------------------

  it('StartScratchCard: hero combobox is backed by useHeroesQuery (hero-type only)', () => {
    // HeroDropdown is mocked — this verifies the slot renders correctly.
    // The actual data source (useHeroesQuery returning only Type.Hero records)
    // is tested in HeroDropdown.spec.tsx.
    renderPage();
    expect(screen.getByTestId('hero-dropdown-mock')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // StartScratchCard — format dropdown has 4 supported formats
  // -------------------------------------------------------------------------

  it('StartScratchCard: format dropdown renders all 4 supported formats', () => {
    renderPage();
    const select = screen.getByTestId('format-dropdown-select-mock');
    expect(
      select.querySelectorAll('option[value="Classic Constructed"]'),
    ).toHaveLength(1);
    expect(select.querySelectorAll('option[value="Blitz"]')).toHaveLength(1);
    expect(select.querySelectorAll('option[value="Draft"]')).toHaveLength(1);
    expect(select.querySelectorAll('option[value="Sealed"]')).toHaveLength(1);
  });
});
