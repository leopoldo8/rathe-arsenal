/**
 * Toast + ToastProvider tests.
 *
 * Test plan (from plan U4):
 *  - Happy path: show() renders a toast, message visible, Retry button present.
 *  - Integration (burst): >=2 errors within 500ms consolidate to single toast.
 *  - Edge case: dismiss returns focus to returnFocusRef.
 *  - Error boundary: useToast outside provider throws.
 *
 * Note on Radix Toast + jsdom:
 *   Radix Toast uses the Pointer Events API (hasPointerCapture / setPointerCapture)
 *   for its swipe-to-dismiss gesture. These are stubbed in src/test/setup.ts.
 *   Timer-dependent dismiss tests use fireEvent.click (avoids userEvent timer
 *   interaction with fake timers) and flush pending state with act().
 */

import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../ToastProvider';
import { useToast } from '../useToast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function TestHarness({
  onMount,
}: {
  readonly onMount: (show: ReturnType<typeof useToast>['show']) => void;
}): React.ReactElement {
  const { show } = useToast();
  React.useEffect(() => {
    onMount(show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div />;
}

function renderWithToast(
  onMount: (show: ReturnType<typeof useToast>['show']) => void,
): void {
  render(
    <ToastProvider>
      <TestHarness onMount={onMount} />
    </ToastProvider>,
  );
}

// ---------------------------------------------------------------------------
// Happy path (fake timers for burst tests)
// ---------------------------------------------------------------------------

describe('Toast — happy path', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('renders a success toast with message text', () => {
    let showFn!: ReturnType<typeof useToast>['show'];
    renderWithToast((fn) => {
      showFn = fn;
    });

    act(() => {
      showFn({ kind: 'success', message: 'Saved successfully' });
    });

    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });

  it('renders a Retry button for a single error toast', () => {
    let showFn!: ReturnType<typeof useToast>['show'];
    const retry = vi.fn();
    renderWithToast((fn) => {
      showFn = fn;
    });

    act(() => {
      showFn({ kind: 'error', message: 'Save failed', retry });
      // Flush burst timer so single error is emitted
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText('Save failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('invokes retry callback when Retry is clicked', () => {
    let showFn!: ReturnType<typeof useToast>['show'];
    const retry = vi.fn();
    renderWithToast((fn) => {
      showFn = fn;
    });

    act(() => {
      showFn({ kind: 'error', message: 'Save failed', retry });
      vi.advanceTimersByTime(600);
    });

    // Use fireEvent to avoid userEvent timer interactions
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    expect(retry).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Happy path (real timers for dismiss test)
// ---------------------------------------------------------------------------

describe('Toast — dismiss behaviour', () => {
  it('dismiss close button removes the toast', async () => {
    let showFn!: ReturnType<typeof useToast>['show'];
    renderWithToast((fn) => {
      showFn = fn;
    });

    act(() => {
      showFn({ kind: 'success', message: 'Action complete' });
    });

    expect(screen.getByText('Action complete')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(closeBtn);

    await waitFor(
      () => {
        expect(screen.queryByText('Action complete')).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});

// ---------------------------------------------------------------------------
// Burst consolidation
// ---------------------------------------------------------------------------

describe('Toast — burst consolidation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('consolidates >=2 errors within 500ms into a single toast', () => {
    let showFn!: ReturnType<typeof useToast>['show'];
    const retry1 = vi.fn();
    const retry2 = vi.fn();
    const retry3 = vi.fn();

    renderWithToast((fn) => {
      showFn = fn;
    });

    act(() => {
      showFn({ kind: 'error', message: 'Error 1', retry: retry1 });
      showFn({ kind: 'error', message: 'Error 2', retry: retry2 });
      showFn({ kind: 'error', message: 'Error 3', retry: retry3 });
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText('3 changes failed')).toBeInTheDocument();
    expect(screen.queryByText('Error 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Error 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Error 3')).not.toBeInTheDocument();
  });

  it('shows "Retry all" button that invokes all queued retry functions', () => {
    let showFn!: ReturnType<typeof useToast>['show'];
    const retry1 = vi.fn();
    const retry2 = vi.fn();

    renderWithToast((fn) => {
      showFn = fn;
    });

    act(() => {
      showFn({ kind: 'error', message: 'Error 1', retry: retry1 });
      showFn({ kind: 'error', message: 'Error 2', retry: retry2 });
      vi.advanceTimersByTime(600);
    });

    const retryAllBtn = screen.getByRole('button', { name: /retry all/i });
    fireEvent.click(retryAllBtn);

    expect(retry1).toHaveBeenCalledOnce();
    expect(retry2).toHaveBeenCalledOnce();
  });

  it('emits individual toasts when errors arrive more than 500ms apart', () => {
    let showFn!: ReturnType<typeof useToast>['show'];

    renderWithToast((fn) => {
      showFn = fn;
    });

    act(() => {
      showFn({ kind: 'error', message: 'First error' });
      vi.advanceTimersByTime(600);
    });

    act(() => {
      showFn({ kind: 'error', message: 'Second error' });
      vi.advanceTimersByTime(600);
    });

    // Two separate windows → both below threshold → individual toasts
    expect(screen.getByText('First error')).toBeInTheDocument();
    expect(screen.getByText('Second error')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Focus return
// ---------------------------------------------------------------------------

describe('Toast — focus return', () => {
  it('returns focus to returnFocusRef element on dismiss', async () => {
    function FocusTestHarness(): React.ReactElement {
      const { show } = useToast();
      const triggerRef = useRef<HTMLButtonElement | null>(null);

      const handleClick = (): void => {
        show({
          kind: 'success',
          message: 'Action done',
          returnFocusRef: triggerRef,
        });
      };

      return (
        <div>
          <button ref={triggerRef} type="button" onClick={handleClick} data-testid="trigger">
            Trigger
          </button>
        </div>
      );
    }

    render(
      <ToastProvider>
        <FocusTestHarness />
      </ToastProvider>,
    );

    const trigger = screen.getByTestId('trigger');
    fireEvent.click(trigger);

    expect(screen.getByText('Action done')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(closeBtn);

    await waitFor(
      () => {
        expect(document.activeElement).toBe(trigger);
      },
      { timeout: 3000 },
    );
  });
});

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

describe('useToast — error boundary', () => {
  it('throws when used outside <ToastProvider>', () => {
    function Broken(): React.ReactElement {
      useToast();
      return <div />;
    }

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Broken />)).toThrow('useToast must be used within <ToastProvider>');

    consoleSpy.mockRestore();
  });
});
