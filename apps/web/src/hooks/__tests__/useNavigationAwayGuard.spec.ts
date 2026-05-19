/**
 * Tests for useNavigationAwayGuard (U13).
 *
 * Covers:
 *  - Uses TanStack Router's useBlocker (NOT router.subscribe)
 *  - beforeunload fires when dirty + isEditMode
 *  - beforeunload does NOT fire when clean
 *  - beforeunload does NOT fire when not in edit mode
 *  - onBlock callback called with proceed/stay when blocker fires
 *  - proceed() allows navigation (returns false from blockerFn)
 *  - stay() cancels navigation (returns true from blockerFn)
 *
 * Note: Full useBlocker integration requires a TanStack Router context.
 * These tests focus on the beforeunload guard (verifiable without a router)
 * and the module-level API contract (useBlocker import).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNavigationAwayGuard } from '../useNavigationAwayGuard';

// ---------------------------------------------------------------------------
// Mock @tanstack/react-router
// ---------------------------------------------------------------------------

const mockUseBlocker = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useBlocker: (...args: unknown[]) => mockUseBlocker(...args),
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockUseBlocker.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// useBlocker API contract
// ---------------------------------------------------------------------------

describe('useNavigationAwayGuard — uses useBlocker (not router.subscribe)', () => {
  it('calls useBlocker with condition and blockerFn when dirty + editMode', () => {
    const onBlock = vi.fn();
    renderHook(() =>
      useNavigationAwayGuard({ isDirty: true, isEditMode: true, onBlock }),
    );
    expect(mockUseBlocker).toHaveBeenCalledTimes(1);
    const opts = mockUseBlocker.mock.calls[0]![0] as { condition: boolean; blockerFn: unknown };
    expect(opts.condition).toBe(true);
    expect(typeof opts.blockerFn).toBe('function');
  });

  it('passes condition=false when not dirty', () => {
    const onBlock = vi.fn();
    renderHook(() =>
      useNavigationAwayGuard({ isDirty: false, isEditMode: true, onBlock }),
    );
    const opts = mockUseBlocker.mock.calls[0]![0] as { condition: boolean };
    expect(opts.condition).toBe(false);
  });

  it('passes condition=false when not in edit mode', () => {
    const onBlock = vi.fn();
    renderHook(() =>
      useNavigationAwayGuard({ isDirty: true, isEditMode: false, onBlock }),
    );
    const opts = mockUseBlocker.mock.calls[0]![0] as { condition: boolean };
    expect(opts.condition).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// blockerFn — proceed and stay
// ---------------------------------------------------------------------------

describe('useNavigationAwayGuard — blockerFn resolve semantics', () => {
  it('blockerFn resolves false (allow nav) when onBlock calls proceed()', async () => {
    let proceedFn: (() => void) | undefined;
    const onBlock = vi.fn((proceed: () => void) => {
      proceedFn = proceed;
    });

    renderHook(() =>
      useNavigationAwayGuard({ isDirty: true, isEditMode: true, onBlock }),
    );

    const blockerFn = (mockUseBlocker.mock.calls[0]![0] as { blockerFn: () => Promise<boolean> }).blockerFn;

    const resultPromise = blockerFn();
    act(() => { proceedFn?.(); });
    const result = await resultPromise;
    // false = allow navigation
    expect(result).toBe(false);
  });

  it('blockerFn resolves true (block nav) when onBlock calls stay()', async () => {
    let stayFn: (() => void) | undefined;
    const onBlock = vi.fn((_proceed: () => void, stay: () => void) => {
      stayFn = stay;
    });

    renderHook(() =>
      useNavigationAwayGuard({ isDirty: true, isEditMode: true, onBlock }),
    );

    const blockerFn = (mockUseBlocker.mock.calls[0]![0] as { blockerFn: () => Promise<boolean> }).blockerFn;

    const resultPromise = blockerFn();
    act(() => { stayFn?.(); });
    const result = await resultPromise;
    // true = block navigation
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// beforeunload guard
// ---------------------------------------------------------------------------

describe('useNavigationAwayGuard — beforeunload', () => {
  it('registers beforeunload listener when dirty + editMode', () => {
    const addListenerSpy = vi.spyOn(window, 'addEventListener');
    const onBlock = vi.fn();

    renderHook(() =>
      useNavigationAwayGuard({ isDirty: true, isEditMode: true, onBlock }),
    );

    expect(addListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('does NOT register beforeunload when clean', () => {
    const addListenerSpy = vi.spyOn(window, 'addEventListener');
    const onBlock = vi.fn();

    renderHook(() =>
      useNavigationAwayGuard({ isDirty: false, isEditMode: true, onBlock }),
    );

    expect(addListenerSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('does NOT register beforeunload when not in edit mode', () => {
    const addListenerSpy = vi.spyOn(window, 'addEventListener');
    const onBlock = vi.fn();

    renderHook(() =>
      useNavigationAwayGuard({ isDirty: true, isEditMode: false, onBlock }),
    );

    expect(addListenerSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('calls e.preventDefault() and sets e.returnValue on beforeunload when dirty', () => {
    const addListenerSpy = vi.spyOn(window, 'addEventListener');
    const onBlock = vi.fn();

    renderHook(() =>
      useNavigationAwayGuard({ isDirty: true, isEditMode: true, onBlock }),
    );

    // Retrieve the registered handler
    const call = addListenerSpy.mock.calls.find((c) => c[0] === 'beforeunload');
    expect(call).toBeDefined();
    const handler = call![1] as (e: BeforeUnloadEvent) => void;

    const mockEvent = {
      preventDefault: vi.fn(),
      returnValue: '',
    } as unknown as BeforeUnloadEvent;

    handler(mockEvent);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockEvent.returnValue).toBe('');
  });

  it('removes beforeunload listener on unmount', () => {
    const removeListenerSpy = vi.spyOn(window, 'removeEventListener');
    const onBlock = vi.fn();

    const { unmount } = renderHook(() =>
      useNavigationAwayGuard({ isDirty: true, isEditMode: true, onBlock }),
    );

    unmount();
    expect(removeListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });
});

// ---------------------------------------------------------------------------
// Status/tag mutations don't affect the guard
// (condition reads isDirty which is NOT affected by status/tag changes)
// ---------------------------------------------------------------------------

describe('useNavigationAwayGuard — status/tag mutations do not trigger guard', () => {
  it('condition is false when isDirty is false (status/tag changes never set isDirty)', () => {
    // This test documents the contract: the guard only fires when isDirty=true.
    // Status dropdown, name rename, tag chip mutations keep isDirty=false
    // because they are not part of the composition draft (per R18a).
    const onBlock = vi.fn();
    renderHook(() =>
      useNavigationAwayGuard({ isDirty: false, isEditMode: true, onBlock }),
    );
    const opts = mockUseBlocker.mock.calls[0]![0] as { condition: boolean };
    expect(opts.condition).toBe(false);
    expect(onBlock).not.toHaveBeenCalled();
  });
});
