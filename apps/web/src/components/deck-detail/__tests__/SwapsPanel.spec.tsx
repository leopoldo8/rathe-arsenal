import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { ISwapRow } from '../../../api/swaps';
import { breakdown, swap, storedSwap } from './deckDetailTestData';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => <a href={props.to}>{props.children}</a>,
}));

import { SwapsPanel } from '../SwapsPanel';

function renderPanel(
  substituted: ReturnType<typeof swap>[],
  deckSwaps: ReturnType<typeof storedSwap>[] = [],
): void {
  render(
    <SwapsPanel
      swaps={breakdown({ substituted }).substituted}
      deckSwaps={deckSwaps as unknown as readonly ISwapRow[]}
      pendingSwapId={null}
      onApprove={vi.fn()}
      onReject={vi.fn()}
      onUndo={vi.fn()}
    />,
  );
}

describe('SwapsPanel grouping', () => {
  it('renders ONE row with x2 when two copies share the same original and substitute', () => {
    renderPanel(
      [
        swap({ cardIdentifier: 'argh', name: 'Argh', quantity: 1 }, 'bloodrush'),
        swap({ cardIdentifier: 'argh', name: 'Argh', quantity: 1 }, 'bloodrush'),
      ],
      [storedSwap('s1', 'argh', 'bloodrush', 2)],
    );

    const cards = screen.getAllByTestId('swap-card');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByTestId('swap-confidence')).toHaveTextContent('Cobre 2 cópias');
  });

  it('sums the engine copies when the swaps list has not loaded yet', () => {
    renderPanel([
      swap({ cardIdentifier: 'argh', quantity: 1 }, 'bloodrush'),
      swap({ cardIdentifier: 'argh', quantity: 1 }, 'bloodrush'),
    ]);

    const cards = screen.getAllByTestId('swap-card');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]!).getByTestId('swap-confidence')).toHaveTextContent('Cobre 2 cópias');
  });

  it('keeps different substitutes of the same original as separate rows', () => {
    renderPanel([
      swap({ cardIdentifier: 'argh', quantity: 1 }, 'bloodrush'),
      swap({ cardIdentifier: 'argh', quantity: 1 }, 'other'),
    ]);

    expect(screen.getAllByTestId('swap-card')).toHaveLength(2);
  });

  it('a single copy reads x1', () => {
    renderPanel([swap({ cardIdentifier: 'argh', quantity: 1 }, 'bloodrush')]);

    expect(screen.getByTestId('swap-confidence')).toHaveTextContent('Cobre 1 cópia');
  });

  it('wires the grouped row to the stored swap id and decision', () => {
    renderPanel(
      [swap({ cardIdentifier: 'argh', quantity: 1 }, 'bloodrush'), swap({ cardIdentifier: 'argh', quantity: 1 }, 'bloodrush')],
      [storedSwap('s1', 'argh', 'bloodrush', 2, 'approved')],
    );

    expect(screen.getByTestId('swap-card')).toHaveAttribute('data-decision', 'approved');
    expect(screen.getByRole('button', { name: /desfazer|undo/i })).toBeEnabled();
  });
});
