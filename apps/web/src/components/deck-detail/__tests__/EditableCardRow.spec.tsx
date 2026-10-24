import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EditableCardRow } from '../EditableCardRow';

function renderRow(name: string, pitch: number | null): void {
  render(
    <ul>
      <EditableCardRow
        cardIdentifier="pack-hunt-red"
        name={name}
        pitch={pitch}
        quantity={2}
        slot="mainboard"
        type="Action"
        imageUrl={null}
        onQuantityChange={vi.fn()}
        onRemove={vi.fn()}
      />
    </ul>,
  );
}

describe('EditableCardRow', () => {
  it('names the pitch', () => {
    renderRow('Pack Hunt', 1);

    expect(screen.getAllByText('Pack Hunt (Vermelho)').length).toBeGreaterThan(0);
    expect(screen.getByRole('group', { name: /Pack Hunt \(Vermelho\)/ })).toBeInTheDocument();
    expect(screen.getByTestId('increment-pack-hunt-red')).toHaveAccessibleName(/Pack Hunt \(Vermelho\)/);
    expect(screen.getByTestId('decrement-pack-hunt-red')).toHaveAccessibleName(/Pack Hunt \(Vermelho\)/);
    expect(screen.getByTestId('remove-pack-hunt-red')).toHaveAccessibleName(/Pack Hunt \(Vermelho\)/);
  });
});
