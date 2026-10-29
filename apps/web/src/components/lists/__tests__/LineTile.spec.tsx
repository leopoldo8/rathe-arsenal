import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('../../../api/lists', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/lists')>();
  return { ...actual, useApplySuggestionsMutation: () => ({ mutate: vi.fn(), isPending: false }) };
});

import { LineTile } from '../LineTile';
import { makeLine } from './listsTestKit';

describe('LineTile', () => {
  it('names the pitch', () => {
    render(
      <ul>
        <LineTile
          listId={7}
          line={makeLine({ cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1 })}
          kind="want"
          selected={false}
          onSelect={vi.fn()}
        />
      </ul>,
    );

    const tile = screen.getByTestId('list-line');
    const button = within(tile).getByRole('button', { name: /Pack Hunt \(Vermelho\)/ });
    expect(button).toBeInTheDocument();
    expect(within(tile).getAllByText('Pack Hunt (Vermelho)').length).toBeGreaterThan(0);
    expect(within(tile).queryByText('Pack Hunt')).toBeNull();
  });

  it('shows Vendida on a line still on sale and on no other', () => {
    render(
      <ul>
        <LineTile listId={7} line={makeLine({ id: 1 })} kind="sell" selected={false} onSelect={vi.fn()} />
        <LineTile listId={7} line={makeLine({ id: 2, sold: true })} kind="sell" selected={false} onSelect={vi.fn()} />
        <LineTile listId={7} line={makeLine({ id: 3 })} kind="want" selected={false} onSelect={vi.fn()} />
      </ul>,
    );

    const buttons = screen.getAllByRole('button', { name: /como vendida$/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Vendida');
  });
});
