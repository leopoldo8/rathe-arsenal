import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OwnedStepper } from '../OwnedStepper';
import { line, Providers } from './missingListKit';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const toast = vi.hoisted(() => ({ show: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: toast.show }) }));

beforeEach(() => {
  api.fetch.mockReset();
  toast.show.mockReset();
});

describe('OwnedStepper', () => {
  it('picking a number sets the owned total and Desfazer restores it', async () => {
    api.fetch.mockResolvedValueOnce({ ownedTotal: 3, previousManualQuantity: 0 }).mockResolvedValueOnce({ ownedTotal: 1, previousManualQuantity: 2 });
    render(
      <Providers>
        <OwnedStepper deckId={7} line={line({ cardIdentifier: 'pack-hunt-yellow', name: 'Pack Hunt', pitch: 2, deckQuantity: 3, ownedTotal: 2, ownedElsewhere: 1 })} />
      </Providers>,
    );

    expect(screen.getByText('Quantas você já tem?')).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['0', '1', '2', '3']);
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: '3' }));

    await waitFor(() => expect(toast.show).toHaveBeenCalledTimes(1));
    expect(api.fetch).toHaveBeenCalledWith('/collection/owned', {
      method: 'PUT',
      body: JSON.stringify({ deckId: 7, cardIdentifier: 'pack-hunt-yellow', ownedTotal: 3 }),
    });
    const shown = toast.show.mock.calls[0]![0] as { message: string; action: { label: string; onClick: () => void } };
    expect(shown.message).toBe('Pack Hunt (Amarelo): você tem 3');
    expect(shown.action.label).toBe('Desfazer');

    shown.action.onClick();

    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(2));
    expect(api.fetch.mock.calls[1]![1]).toEqual({
      method: 'PUT',
      // The manual source goes back to the 0 the response named (the other imports still hold 1): 1 in all, not the 2 shown before.
      body: JSON.stringify({ deckId: 7, cardIdentifier: 'pack-hunt-yellow', ownedTotal: 1 }),
    });
  });

  it('options below what other sources hold are disabled', () => {
    render(
      <Providers>
        <OwnedStepper deckId={7} line={line({ deckQuantity: 3, ownedTotal: 2, ownedElsewhere: 2 })} />
      </Providers>,
    );

    expect(screen.getByRole('button', { name: '0' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '2' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '3' })).toBeEnabled();
    expect(screen.getByText('Você tem 2 na sua biblioteca')).toBeInTheDocument();
  });
});
