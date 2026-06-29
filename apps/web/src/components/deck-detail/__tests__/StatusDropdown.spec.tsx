/**
 * Unit tests for <StatusDropdown /> (U8)
 *
 * Test scenarios:
 *  - Happy path: selecting "Active" fires the PATCH and reflects in trigger.
 *  - In-flight: trigger is disabled and shows spinner while PATCH is pending.
 *  - Error path: PATCH fails → trigger reverts to previous status; useToast().show
 *    called with kind: 'error', message text, retry callback, and returnFocusRef.
 *  - ARIA: trigger has aria-label="Change deck status — currently {label}".
 */

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusDropdown } from '../StatusDropdown';

// ---------------------------------------------------------------------------
// jsdom stubs — Radix Select calls scrollIntoView internally
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined' && !window.Element.prototype.scrollIntoView) {
  window.Element.prototype.scrollIntoView = vi.fn();
}

// ---------------------------------------------------------------------------
// Mock state — mutable config so vi.mock closures pick up changes
// ---------------------------------------------------------------------------

const patchConfig: {
  isPending: boolean;
} = { isPending: false };

// Captured callbacks
let capturedOnError: (() => void) | undefined;

const spies = {
  mutate: vi.fn(),
  toast: vi.fn(),
};

vi.mock('../../../api/decks', () => ({
  usePatchDeckMutation: vi.fn(() => ({
    mutate: (body: unknown, callbacks?: { onError?: () => void; onSuccess?: () => void }) => {
      capturedOnError = callbacks?.onError;
      spies.mutate(body, callbacks);
    },
    isPending: patchConfig.isPending,
  })),
}));

vi.mock('../../ui/Toast/useToast', () => ({
  useToast: () => ({ show: spies.toast }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDropdown(currentStatus: 'idea' | 'building' | 'ready' | 'active' | 'retired' = 'idea') {
  return render(
    <StatusDropdown deckId={42} currentStatus={currentStatus} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatusDropdown — ARIA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.mutate.mockReset();
    spies.toast.mockReset();
    patchConfig.isPending = false;
    capturedOnError = undefined;
  });

  it('trigger has aria-label with current status label for "idea"', () => {
    renderDropdown('idea');
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute(
      'aria-label',
      'Alterar status do baralho — atualmente Ideia',
    );
  });

  it('trigger aria-label reflects "Active" status', () => {
    renderDropdown('active');
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute(
      'aria-label',
      'Alterar status do baralho — atualmente Ativo',
    );
  });

  it('trigger aria-label reflects "Building" status', () => {
    renderDropdown('building');
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-label',
      'Alterar status do baralho — atualmente Construindo',
    );
  });

  it('trigger shows the current StatusBullet label text', () => {
    renderDropdown('ready');
    // The trigger should contain the status label text
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    // StatusBullet renders the label as a span
    expect(screen.getByText('Pronto')).toBeInTheDocument();
  });
});

describe('StatusDropdown — happy path (opening dropdown)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.mutate.mockReset();
    spies.toast.mockReset();
    patchConfig.isPending = false;
    capturedOnError = undefined;
  });

  it('opens the dropdown when trigger is clicked', async () => {
    renderDropdown('idea');
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => {
      // Radix Select renders a listbox when open
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  it('all 5 status options appear when dropdown is open', async () => {
    renderDropdown('idea');
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options.length).toBe(5);
    });
  });

  it('calls usePatchDeckMutation with the selected status', async () => {
    renderDropdown('idea');
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getAllByRole('option').length === 5);

    const activeOption = screen.getAllByRole('option').find((el) =>
      el.textContent?.includes('Ativo'),
    );
    expect(activeOption).toBeDefined();
    fireEvent.click(activeOption!);

    expect(spies.mutate).toHaveBeenCalledWith(
      { status: 'active' },
      expect.any(Object),
    );
  });

  it('optimistically updates the trigger label after selection', async () => {
    renderDropdown('idea');
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getAllByRole('option').length === 5);

    const activeOption = screen.getAllByRole('option').find((el) =>
      el.textContent?.includes('Ativo'),
    );
    fireEvent.click(activeOption!);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveAttribute(
        'aria-label',
        'Alterar status do baralho — atualmente Ativo',
      );
    });
  });
});

describe('StatusDropdown — in-flight state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.mutate.mockReset();
    patchConfig.isPending = true;
    capturedOnError = undefined;
  });

  it('trigger has data-disabled attribute when isPending is true', () => {
    renderDropdown('building');
    const trigger = screen.getByRole('combobox');
    // Radix Select renders `data-disabled` when the root is disabled
    expect(trigger).toHaveAttribute('data-disabled');
  });
});

describe('StatusDropdown — error path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.mutate.mockReset();
    spies.toast.mockReset();
    patchConfig.isPending = false;
    capturedOnError = undefined;
  });

  it('calls useToast().show with error kind on PATCH failure', async () => {
    renderDropdown('idea');
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getAllByRole('option').length === 5);

    const activeOption = screen.getAllByRole('option').find((el) =>
      el.textContent?.includes('Ativo'),
    );
    fireEvent.click(activeOption!);

    act(() => { capturedOnError?.(); });

    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        message: expect.stringContaining('Não foi possível atualizar o status'),
        retry: expect.any(Function),
        returnFocusRef: expect.any(Object),
      }),
    );
  });

  it('reverts trigger label to previous status on PATCH failure', async () => {
    renderDropdown('idea');
    const trigger = screen.getByRole('combobox');

    expect(trigger).toHaveAttribute(
      'aria-label',
      'Alterar status do baralho — atualmente Ideia',
    );

    // Select Active
    fireEvent.click(trigger);
    await waitFor(() => screen.getAllByRole('option').length === 5);
    const activeOption = screen.getAllByRole('option').find((el) =>
      el.textContent?.includes('Ativo'),
    );
    fireEvent.click(activeOption!);

    // Optimistic update → Active
    await waitFor(() => {
      expect(trigger).toHaveAttribute(
        'aria-label',
        'Alterar status do baralho — atualmente Ativo',
      );
    });

    // Fire error callback — should revert to Idea
    act(() => { capturedOnError?.(); });

    await waitFor(() => {
      expect(trigger).toHaveAttribute(
        'aria-label',
        'Alterar status do baralho — atualmente Ideia',
      );
    });
  });

  it('retry callback in toast payload re-fires the mutation', async () => {
    renderDropdown('idea');
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getAllByRole('option').length === 5);
    const activeOption = screen.getAllByRole('option').find((el) =>
      el.textContent?.includes('Ativo'),
    );
    fireEvent.click(activeOption!);

    act(() => { capturedOnError?.(); });

    expect(spies.toast).toHaveBeenCalledTimes(1);
    const toastPayload = spies.toast.mock.calls[0]?.[0] as { retry: () => void } | undefined;
    expect(toastPayload).toBeDefined();
    // Invoke the retry
    act(() => { toastPayload?.retry(); });
    // mutate called at least twice total (original + retry)
    expect(spies.mutate.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
