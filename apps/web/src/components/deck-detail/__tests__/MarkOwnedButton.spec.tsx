import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkOwnedButton } from '../MarkOwnedButton';

describe('MarkOwnedButton', () => {
  it('names the card it marks', () => {
    render(
      <>
        <MarkOwnedButton
          cardIdentifier="pack-hunt-red"
          name="Pack Hunt"
          pitch={1}
          onMarkOwned={vi.fn()}
          isPending={false}
          pendingCard={null}
        />
        <MarkOwnedButton
          cardIdentifier="pack-hunt-blue"
          name="Pack Hunt"
          pitch={3}
          onMarkOwned={vi.fn()}
          isPending={false}
          pendingCard={null}
        />
      </>,
    );

    expect(screen.getByRole('button', { name: 'Já tenho Pack Hunt (Vermelho)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Já tenho Pack Hunt (Azul)' })).toBeInTheDocument();
  });
});
