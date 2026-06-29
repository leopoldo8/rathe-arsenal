import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LibraryGrid } from '../LibraryGrid';
import type { ILibraryCard } from '../../../api/library';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// CardArt renders SVGs with complex internals — stub it for test speed.
vi.mock('../../card-art/CardArt', () => ({
  CardArt: ({ name }: { name: string }) => (
    <div data-testid="card-art" aria-label={name} />
  ),
}));

// LibraryCardStepper depends on the auth-aware api client. Stub it to a
// noop so LibraryGrid's grouping/cell tests stay focused on layout.
vi.mock('../LibraryCardStepper', () => ({
  LibraryCardStepper: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<ILibraryCard> = {}): ILibraryCard {
  return {
    cardIdentifier: 'WTR000',
    name: 'Test Card',
    pitch: null,
    types: ['attack'],
    subtypes: [],
    classes: [],
    talents: [],
    sets: ['WTR'],
    imageUrl: null,
    ownedQuantity: 1,
    contributions: [],
    ...overrides,
  };
}

function makeCards(count: number): readonly ILibraryCard[] {
  return Array.from({ length: count }, (_, i) =>
    makeCard({
      cardIdentifier: `WTR${String(i).padStart(3, '0')}`,
      name: `Card ${i}`,
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LibraryGrid — happy path: renders all cards', () => {
  it('renders 20 list items for 20 cards', () => {
    const cards = makeCards(20);
    render(<LibraryGrid cards={cards} group="flat" />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(20);
  });

  it('each cell has an aria-label with the card name and owned quantity (pt-BR)', () => {
    const card = makeCard({ name: 'Hammer of Sol', ownedQuantity: 3 });
    render(<LibraryGrid cards={[card]} group="flat" />);
    expect(
      screen.getByRole('listitem', { name: /Hammer of Sol.*na coleção: 3/i }),
    ).toBeInTheDocument();
  });

  it('renders a quantity badge for each card', () => {
    const cards = [
      makeCard({ cardIdentifier: 'A1', name: 'A', ownedQuantity: 2 }),
      makeCard({ cardIdentifier: 'A2', name: 'B', ownedQuantity: 5 }),
    ];
    render(<LibraryGrid cards={cards} group="flat" />);
    expect(screen.getByText('×2')).toBeInTheDocument();
    expect(screen.getByText('×5')).toBeInTheDocument();
  });
});

describe('LibraryGrid — grouping by type', () => {
  it('groups cards by type and renders a section header (type headings stay in English — game data)', () => {
    const cards = [
      makeCard({ cardIdentifier: 'A1', name: 'Hammer', types: ['attack'] }),
      makeCard({ cardIdentifier: 'D1', name: 'Shield', types: ['defense'] }),
    ];
    render(<LibraryGrid cards={cards} group="type" />);
    expect(screen.getByRole('heading', { name: 'attack' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'defense' })).toBeInTheDocument();
  });

  it('places cards into correct type groups', () => {
    const cards = [
      makeCard({ cardIdentifier: 'A1', name: 'Hammer', types: ['attack'] }),
      makeCard({ cardIdentifier: 'D1', name: 'Shield', types: ['defense'] }),
    ];
    render(<LibraryGrid cards={cards} group="type" />);
    // Each type group renders a <ul aria-label="attack"> / <ul aria-label="defense">
    const attackList = screen.getByRole('list', { name: 'attack' });
    expect(within(attackList).getByText('Hammer')).toBeInTheDocument();
  });
});

describe('LibraryGrid — grouping by pitch', () => {
  it('groups cards by pitch label (pt-BR pitch headings)', () => {
    const cards = [
      makeCard({ cardIdentifier: 'R1', name: 'Red Card', pitch: 1 }),
      makeCard({ cardIdentifier: 'B1', name: 'Blue Card', pitch: 3 }),
    ];
    render(<LibraryGrid cards={cards} group="pitch" />);
    expect(screen.getByRole('heading', { name: 'Vermelho' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Azul' })).toBeInTheDocument();
  });

  it('groups null-pitch cards as Incolor (pt-BR)', () => {
    const cards = [makeCard({ name: 'Equipment', pitch: null })];
    render(<LibraryGrid cards={cards} group="pitch" />);
    expect(screen.getByRole('heading', { name: 'Incolor' })).toBeInTheDocument();
  });
});

describe('LibraryGrid — grouping by set', () => {
  it('groups cards by set code', () => {
    const cards = [
      makeCard({ cardIdentifier: 'W1', name: 'Old Card', sets: ['WTR'] }),
      makeCard({ cardIdentifier: 'C1', name: 'New Card', sets: ['CRU'] }),
    ];
    render(<LibraryGrid cards={cards} group="set" />);
    expect(screen.getByRole('heading', { name: 'CRU' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'WTR' })).toBeInTheDocument();
  });
});

describe('LibraryGrid — flat grouping', () => {
  it('does not render group headings in flat mode', () => {
    const cards = [
      makeCard({ cardIdentifier: 'A1', types: ['attack'] }),
      makeCard({ cardIdentifier: 'D1', types: ['defense'] }),
    ];
    render(<LibraryGrid cards={cards} group="flat" />);
    // h2 headings should not exist
    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0);
  });
});

describe('LibraryGrid — grouping toggle: no refetch', () => {
  it('re-renders in new group order when group prop changes, same card data', () => {
    const cards = [
      makeCard({ cardIdentifier: 'R1', name: 'Red Card', pitch: 1, types: ['attack'] }),
      makeCard({ cardIdentifier: 'B1', name: 'Blue Card', pitch: 3, types: ['defense'] }),
    ];
    const { rerender } = render(<LibraryGrid cards={cards} group="type" />);
    // Initially grouped by type
    expect(screen.getByRole('heading', { name: 'attack' })).toBeInTheDocument();

    // Rerender with pitch grouping — same cards, no refetch
    rerender(<LibraryGrid cards={cards} group="pitch" />);
    expect(screen.queryByRole('heading', { name: 'attack' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vermelho' })).toBeInTheDocument();
  });
});

describe('LibraryGrid — accessibility', () => {
  it('uses ul/li semantics', () => {
    const cards = makeCards(3);
    render(<LibraryGrid cards={cards} group="flat" />);
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('each cell aria-label includes name and owned quantity (pt-BR)', () => {
    const card = makeCard({ name: 'Surging Strike', ownedQuantity: 2 });
    render(<LibraryGrid cards={[card]} group="flat" />);
    expect(
      screen.getByRole('listitem', { name: /Surging Strike.*na coleção: 2/i }),
    ).toBeInTheDocument();
  });
});

describe('LibraryGrid — Action subtype split (group=type)', () => {
  it('renders separate "Attack Action" and "Non-Attack Action" headings (game data — stays English)', () => {
    const cards = [
      makeCard({
        cardIdentifier: 'A1',
        name: 'Wild Ride',
        types: ['Action'],
        subtypes: ['Attack'],
      }),
      makeCard({
        cardIdentifier: 'A2',
        name: 'Nimblism',
        types: ['Action'],
        subtypes: ['Non-Attack'],
      }),
    ];
    render(<LibraryGrid cards={cards} group="type" />);
    expect(screen.getByRole('heading', { name: /^Attack Action$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^Non-Attack Action$/i })).toBeInTheDocument();
  });

  it('keeps top-level types untouched (Equipment, Weapon, etc.)', () => {
    const cards = [
      makeCard({ cardIdentifier: 'E1', name: 'Hide Tanner', types: ['Equipment'], subtypes: ['Arms'] }),
      makeCard({ cardIdentifier: 'W1', name: 'Romping Club', types: ['Weapon'], subtypes: [] }),
    ];
    render(<LibraryGrid cards={cards} group="type" />);
    expect(screen.getByRole('heading', { name: /Equipment/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Weapon/ })).toBeInTheDocument();
  });
});

describe('LibraryGrid — arena type groups sort last', () => {
  it('orders deck-card groups before Equipment / Hero / Weapon / Token', () => {
    const cards = [
      makeCard({ cardIdentifier: 'EQ', name: 'Hide Tanner', types: ['Equipment'] }),
      makeCard({ cardIdentifier: 'WP', name: 'Romping Club', types: ['Weapon'] }),
      makeCard({ cardIdentifier: 'AA', name: 'Wild Ride', types: ['Action'], subtypes: ['Attack'] }),
      makeCard({ cardIdentifier: 'BL', name: 'Sigil of Solace', types: ['Block'] }),
      makeCard({ cardIdentifier: 'HE', name: 'Kayo', types: ['Hero'] }),
      makeCard({ cardIdentifier: 'TK', name: 'Might', types: ['Token'] }),
    ];
    render(<LibraryGrid cards={cards} group="type" />);
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent);
    // All deck-card group names come before all arena ones.
    const arenaIndices = headings
      .map((name, i) => (['Equipment', 'Hero', 'Token', 'Weapon'].includes(name ?? '') ? i : -1))
      .filter((i) => i !== -1);
    const deckIndices = headings
      .map((name, i) => (['Equipment', 'Hero', 'Token', 'Weapon'].includes(name ?? '') ? -1 : i))
      .filter((i) => i !== -1);
    expect(Math.min(...arenaIndices)).toBeGreaterThan(Math.max(...deckIndices));
    // Within each block, alphabetical order survives.
    expect(headings).toEqual([
      'Attack Action',
      'Block',
      'Equipment',
      'Hero',
      'Token',
      'Weapon',
    ]);
  });
});

describe('LibraryGrid — stable in-group sort', () => {
  it('sorts cards alphabetically by name within each group', () => {
    const cards = [
      makeCard({ cardIdentifier: 'C', name: 'Charlie' }),
      makeCard({ cardIdentifier: 'A', name: 'Alpha' }),
      makeCard({ cardIdentifier: 'B', name: 'Bravo' }),
    ];
    render(<LibraryGrid cards={cards} group="flat" />);
    // The display order doesn't depend on the input array; alpha → beta → charlie.
    const items = screen.getAllByRole('listitem');
    expect(items.map((el) => el.getAttribute('aria-label'))).toEqual([
      'Alpha, na coleção: 1',
      'Bravo, na coleção: 1',
      'Charlie, na coleção: 1',
    ]);
  });

  it('keeps the same position when ownedQuantity changes (regression: decrement no longer reorders)', () => {
    // Two cards alphabetical order: "Alpha" before "Bravo" regardless of qty.
    const cards = [
      makeCard({ cardIdentifier: 'A', name: 'Alpha', ownedQuantity: 1 }),
      makeCard({ cardIdentifier: 'B', name: 'Bravo', ownedQuantity: 5 }),
    ];
    const { rerender } = render(<LibraryGrid cards={cards} group="flat" />);
    let items = screen.getAllByRole('listitem');
    expect(items[0]?.getAttribute('aria-label')).toBe('Alpha, na coleção: 1');

    // Simulate API refetch returning cards in a different array order
    // (e.g. Postgres reordered after a row mutation). Bravo's qty
    // dropped 5 → 2, but Alpha is still first because of the alpha sort.
    rerender(
      <LibraryGrid
        cards={[
          makeCard({ cardIdentifier: 'B', name: 'Bravo', ownedQuantity: 2 }),
          makeCard({ cardIdentifier: 'A', name: 'Alpha', ownedQuantity: 1 }),
        ]}
        group="flat"
      />,
    );
    items = screen.getAllByRole('listitem');
    expect(items[0]?.getAttribute('aria-label')).toBe('Alpha, na coleção: 1');
    expect(items[1]?.getAttribute('aria-label')).toBe('Bravo, na coleção: 2');
  });
});
