/**
 * Tests for LibraryCardStepper — the hover ± control on /library cells.
 * Mocks the add + decrement mutations so the focus stays on UX behaviour:
 *   - Disabled states reflect contributions.
 *   - Single-source `−` decrements directly.
 *   - Multi-source `−` opens a picker; clicking a row decrements that source.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const addMutate = vi.fn();
const decrementMutate = vi.fn();
const addState = { isPending: false };
const decrementState = { isPending: false };

vi.mock('../../../api/collection', () => ({
  useAddCardMutation: () => ({
    mutate: addMutate,
    isPending: addState.isPending,
  }),
  useDecrementCardMutation: () => ({
    mutate: decrementMutate,
    isPending: decrementState.isPending,
  }),
}));

import { LibraryCardStepper } from '../LibraryCardStepper';
import type { ILibraryCard } from '../../../api/library';

function makeCard(overrides: Partial<ILibraryCard> = {}): ILibraryCard {
  return {
    cardIdentifier: 'WTR001',
    name: 'Hammer',
    pitch: 1,
    types: ['attack'],
    subtypes: [],
    classes: [],
    talents: [],
    sets: ['WTR'],
    imageUrl: null,
    ownedQuantity: 0,
    contributions: [],
    ...overrides,
  };
}

beforeEach(() => {
  addMutate.mockReset();
  decrementMutate.mockReset();
  addState.isPending = false;
  decrementState.isPending = false;
});

describe('LibraryCardStepper — base controls', () => {
  it('disables the − button when no source is contributing', () => {
    render(<LibraryCardStepper card={makeCard({ contributions: [] })} />);
    expect(screen.getByRole('button', { name: /Remove one/i })).toBeDisabled();
  });

  it('enables the − button when at least one source contributes', () => {
    render(
      <LibraryCardStepper
        card={makeCard({
          ownedQuantity: 1,
          contributions: [
            { sourceId: 's1', sourceLabel: 'Manual entries', kind: 'manual', quantity: 1 },
          ],
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /Remove one/i })).not.toBeDisabled();
  });

  it('disables the + button when ownedQuantity already reached the cap', () => {
    render(
      <LibraryCardStepper
        card={makeCard({ ownedQuantity: 20 })}
        maxQuantity={20}
      />,
    );
    expect(screen.getByRole('button', { name: /Add one/i })).toBeDisabled();
  });
});

describe('LibraryCardStepper — single-source decrement', () => {
  it('mutates directly without showing the picker', async () => {
    render(
      <LibraryCardStepper
        card={makeCard({
          ownedQuantity: 2,
          contributions: [
            { sourceId: 's1', sourceLabel: 'Manual entries', kind: 'manual', quantity: 2 },
          ],
        })}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Remove one/i }));
    expect(decrementMutate).toHaveBeenCalledWith({
      cardIdentifier: 'WTR001',
      sourceId: 's1',
      quantity: 1,
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('LibraryCardStepper — multi-source picker', () => {
  const MULTI_SOURCE_CARD = makeCard({
    ownedQuantity: 4,
    contributions: [
      { sourceId: 's-manual', sourceLabel: 'Manual entries', kind: 'manual', quantity: 1 },
      { sourceId: 's-csv', sourceLabel: 'Fabrary: Kayo Brute Bash', kind: 'csv', quantity: 3 },
    ],
  });

  it('opens a picker menu instead of decrementing immediately', async () => {
    render(<LibraryCardStepper card={MULTI_SOURCE_CARD} />);
    await userEvent.click(screen.getByRole('button', { name: /Remove one/i }));
    expect(decrementMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /Manual entries/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /Fabrary: Kayo Brute Bash/i }),
    ).toBeInTheDocument();
  });

  it('toggles aria-expanded on the trigger as the picker opens and closes', async () => {
    render(<LibraryCardStepper card={MULTI_SOURCE_CARD} />);
    const trigger = screen.getByRole('button', { name: /Remove one/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('decrements the picked source on row click', async () => {
    render(<LibraryCardStepper card={MULTI_SOURCE_CARD} />);
    await userEvent.click(screen.getByRole('button', { name: /Remove one/i }));
    await userEvent.click(
      screen.getByRole('menuitem', { name: /Fabrary: Kayo Brute Bash/i }),
    );
    expect(decrementMutate).toHaveBeenCalledWith({
      cardIdentifier: 'WTR001',
      sourceId: 's-csv',
      quantity: 1,
    });
  });
});

describe('LibraryCardStepper — add', () => {
  it('mutates +1 manual on click', async () => {
    render(<LibraryCardStepper card={makeCard({ ownedQuantity: 0 })} />);
    await userEvent.click(screen.getByRole('button', { name: /Add one/i }));
    expect(addMutate).toHaveBeenCalledWith({
      cardIdentifier: 'WTR001',
      quantity: 1,
    });
  });
});
