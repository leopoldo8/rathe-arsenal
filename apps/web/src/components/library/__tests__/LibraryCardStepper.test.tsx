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
    expect(screen.getByRole('button', { name: /Remover um/i })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: /Remover um/i })).not.toBeDisabled();
  });

  it('disables the + button when ownedQuantity already reached the cap', () => {
    render(
      <LibraryCardStepper
        card={makeCard({ ownedQuantity: 20 })}
        maxQuantity={20}
      />,
    );
    expect(screen.getByRole('button', { name: /Adicionar um/i })).toBeDisabled();
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
    await userEvent.click(screen.getByRole('button', { name: /Remover um/i }));
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
    await userEvent.click(screen.getByRole('button', { name: /Remover um/i }));
    expect(decrementMutate).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /Entradas manuais/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /Fabrary: Kayo Brute Bash/i }),
    ).toBeInTheDocument();
  });

  it('toggles aria-expanded on the trigger as the picker opens and closes', async () => {
    render(<LibraryCardStepper card={MULTI_SOURCE_CARD} />);
    const trigger = screen.getByRole('button', { name: /Remover um/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('decrements the picked source on row click', async () => {
    render(<LibraryCardStepper card={MULTI_SOURCE_CARD} />);
    await userEvent.click(screen.getByRole('button', { name: /Remover um/i }));
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

describe('LibraryCardStepper — imports and versions', () => {
  const UNVERSIONED = { printingCode: '', edition: '', finish: '', condition: '' };
  const MARKED = { printingCode: 'WTR167', edition: 'unlimited', finish: 'rainbow', condition: 'NM' };
  const SEVERAL = makeCard({
    cardIdentifier: 'snatch-red',
    name: 'Snatch',
    ownedQuantity: 4,
    contributions: [
      { sourceId: 'list', sourceLabel: 'Lista colada', kind: 'csv', quantity: 2, ...UNVERSIONED },
      { sourceId: 'list', sourceLabel: 'Lista colada', kind: 'csv', quantity: 1, ...MARKED },
      { sourceId: 'kayo', sourceLabel: 'Armory Deck: Kayo', kind: 'csv', quantity: 1, ...UNVERSIONED },
    ],
  });

  it('minus on a card with several imports or versions opens the picker', async () => {
    render(<LibraryCardStepper card={SEVERAL} />);

    await userEvent.click(screen.getByRole('button', { name: /Remover um/i }));

    expect(decrementMutate).not.toHaveBeenCalled();
    const rows = screen.getAllByRole('menuitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Lista colada×2',
      'Lista colada · WTR167 · Unlimited · Rainbow Foil · NM×1',
      'Armory Deck: Kayo×1',
    ]);
  });

  it('takes the copy from the import and version that was picked', async () => {
    render(<LibraryCardStepper card={SEVERAL} />);

    await userEvent.click(screen.getByRole('button', { name: /Remover um/i }));
    await userEvent.click(screen.getByRole('menuitem', { name: /WTR167/ }));

    expect(decrementMutate).toHaveBeenCalledWith({
      cardIdentifier: 'snatch-red',
      sourceId: 'list',
      ...MARKED,
      quantity: 1,
    });
  });

  it('a card in one import at one version is decremented at once, naming that version', async () => {
    const single = makeCard({
      cardIdentifier: 'snatch-red',
      ownedQuantity: 1,
      contributions: [{ sourceId: 'list', sourceLabel: 'Lista colada', kind: 'csv', quantity: 1, ...MARKED }],
    });
    render(<LibraryCardStepper card={single} />);

    await userEvent.click(screen.getByRole('button', { name: /Remover um/i }));

    expect(decrementMutate).toHaveBeenCalledWith({ cardIdentifier: 'snatch-red', sourceId: 'list', ...MARKED, quantity: 1 });
  });
});

describe('LibraryCardStepper — add', () => {
  it('mutates +1 manual on click', async () => {
    render(<LibraryCardStepper card={makeCard({ ownedQuantity: 0 })} />);
    await userEvent.click(screen.getByRole('button', { name: /Adicionar um/i }));
    expect(addMutate).toHaveBeenCalledWith({
      cardIdentifier: 'WTR001',
      quantity: 1,
    });
  });
});
