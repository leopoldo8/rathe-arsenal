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
import { withLinkMock } from '../../../test/router-link-mock';

vi.mock('@tanstack/react-router', async (importOriginal) => withLinkMock(await importOriginal<object>()));

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
      'Mudar status do deck, atualmente Ideia',
    );
  });

  it('trigger aria-label reflects "Active" status', () => {
    renderDropdown('active');
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute(
      'aria-label',
      'Mudar status do deck, atualmente Jogando',
    );
  });

  it('trigger aria-label reflects "Building" status', () => {
    renderDropdown('building');
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-label',
      'Mudar status do deck, atualmente Montando',
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
      el.textContent?.includes('Jogando'),
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
      el.textContent?.includes('Jogando'),
    );
    fireEvent.click(activeOption!);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveAttribute(
        'aria-label',
        'Mudar status do deck, atualmente Jogando',
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
      el.textContent?.includes('Jogando'),
    );
    fireEvent.click(activeOption!);

    act(() => { capturedOnError?.(); });

    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        message: expect.stringContaining('Não foi possível mudar o status'),
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
      'Mudar status do deck, atualmente Ideia',
    );

    // Select Active
    fireEvent.click(trigger);
    await waitFor(() => screen.getAllByRole('option').length === 5);
    const activeOption = screen.getAllByRole('option').find((el) =>
      el.textContent?.includes('Jogando'),
    );
    fireEvent.click(activeOption!);

    // Optimistic update → Active
    await waitFor(() => {
      expect(trigger).toHaveAttribute(
        'aria-label',
        'Mudar status do deck, atualmente Jogando',
      );
    });

    // Fire error callback — should revert to Idea
    act(() => { capturedOnError?.(); });

    await waitFor(() => {
      expect(trigger).toHaveAttribute(
        'aria-label',
        'Mudar status do deck, atualmente Ideia',
      );
    });
  });

  it('retry callback in toast payload re-fires the mutation', async () => {
    renderDropdown('idea');
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => screen.getAllByRole('option').length === 5);
    const activeOption = screen.getAllByRole('option').find((el) =>
      el.textContent?.includes('Jogando'),
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

describe('StatusDropdown on a deck with problems', () => {
  it('the stage stays editable on a deck with problems', async () => {
    // The verdict is not an input of the control: a deck with a rule problem renders it as any other.
    renderDropdown('active');
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeEnabled();

    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(5));
    expect(screen.getAllByRole('option').map((option) => option.textContent?.trim())).toEqual([
      'Ideia',
      'Montando',
      'Pronto',
      'Jogando',
      'Aposentado',
    ]);
  });
});

describe('StatusDropdown — the "?" of Aposentado', () => {
  const RETIRED_SENTENCE =
    'Etapa de um deck que você não usa mais. Ele fica no grupo Aposentados, salvo com as cartas, e volta a ser usado quando você quiser.';

  function setPhone(isPhone: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: isPhone && query.includes('max-width'),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  }

  async function openMenu(): Promise<void> {
    render(<StatusDropdown deckId={42} currentStatus="idea" deckName="Rhinar Blitz v2" cardCount={12} />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(5));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    spies.mutate.mockReset();
    patchConfig.isPending = false;
  });

  it('the question mark never picks the option', async () => {
    setPhone(false);
    await openMenu();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'O que é Aposentado?' }));
    fireEvent.pointerUp(screen.getByRole('button', { name: 'O que é Aposentado?' }));
    fireEvent.click(screen.getByRole('button', { name: 'O que é Aposentado?' }));

    expect(await screen.findByRole('heading', { name: 'Aposentado' })).toBeInTheDocument();
    expect(spies.mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { hidden: true })).toHaveAttribute('aria-label', 'Mudar status do deck, atualmente Ideia');

    fireEvent.click(screen.getAllByRole('option').find((option) => option.textContent?.includes('Aposentado'))!);

    expect(spies.mutate).toHaveBeenCalledWith({ status: 'retired' }, expect.any(Object));
  });

  it('matches b2-stage-retire-phone', async () => {
    setPhone(true);
    await openMenu();

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Ideia',
      'Montando',
      'Pronto',
      'Jogando',
      'Aposentado',
    ]);
    const retired = screen.getAllByRole('option')[4]!;
    const question = screen.getByRole('button', { name: 'O que é Aposentado?' });
    expect(retired.contains(question)).toBe(false);
    expect(retired.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(question);

    const sheet = await screen.findByRole('dialog', { name: 'Aposentado' });
    expect(Array.from(sheet.querySelectorAll('h2, p, a, button')).map((node) => node.textContent)).toEqual([
      'Aposentado',
      RETIRED_SENTENCE,
      'Seu deck Rhinar Blitz v2 continua salvo com as 12 cartas.',
      'Ver todos os termos',
      'Fechar',
    ]);
  });
});
