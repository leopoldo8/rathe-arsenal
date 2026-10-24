import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { CardGalleryCell } from '../CardGalleryCell';

function renderCell(name: string, pitch: 1 | 2 | 3 | null): HTMLElement {
  render(
    <ul>
      <CardGalleryCell
        name={name}
        pitch={pitch}
        cost={null}
        type="Action"
        imageUrl={null}
        missing={false}
        onOpen={vi.fn()}
        testId="cell"
      />
    </ul>,
  );
  return screen.getByTestId('cell');
}

describe('CardGalleryCell', () => {
  it('names the pitch', () => {
    const cell = renderCell('Pack Hunt', 1);

    expect(within(cell).getAllByText('Pack Hunt (Vermelho)').length).toBeGreaterThan(0);
    expect(within(cell).getByRole('img', { name: 'Pack Hunt (Vermelho)' })).toBeInTheDocument();
    expect(within(cell).queryByText('Pack Hunt')).toBeNull();
  });

  it('keeps a card with no pitch under its name', () => {
    const cell = renderCell('Dawnblade', null);

    expect(within(cell).getByRole('img', { name: 'Dawnblade' })).toBeInTheDocument();
    expect(within(cell).queryByText(/\(/)).toBeNull();
  });
});
