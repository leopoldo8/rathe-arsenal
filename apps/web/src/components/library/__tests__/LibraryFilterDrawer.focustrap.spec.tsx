/**
 * LibraryFilterDrawer — focus-trap unit tests (T7, UXUI-03)
 *
 * Verifies:
 *   1. Focus moves to the close button when the drawer opens
 *   2. Tab at the last focusable element cycles back to the first
 *   3. Focus restores to the opener element when the drawer closes (unmount)
 *
 * LibraryFilterRail is mocked to avoid its complex render tree — the focus-trap
 * behavior under test lives in LibraryFilterDrawer, not its children.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

// Mock LibraryFilterRail to a minimal stub so the drawer renders without
// needing real card data or the full filter UI.
vi.mock('../LibraryFilterRail', () => ({
  LibraryFilterRail: () => <div data-testid="mock-filter-rail" />,
}));

import { LibraryFilterDrawer } from '../LibraryFilterDrawer';
import type { ILibraryFiltersValue } from '../LibraryFilterRail';

const EMPTY_FILTERS: ILibraryFiltersValue = {
  pitches: [],
  types: [],
  classes: [],
  talents: [],
  sets: [],
  group: 'type',
  cardSize: 120,
};

const BASE_PROPS = {
  open: true,
  onClose: vi.fn(),
  cards: [],
  value: EMPTY_FILTERS,
  onChange: vi.fn(),
  searchQuery: '',
  onSearchChange: vi.fn(),
  matchingCount: 0,
} as const;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('LibraryFilterDrawer — focus trap (T7)', () => {
  it('moves initial focus to the close button when the drawer opens', () => {
    render(<LibraryFilterDrawer {...BASE_PROPS} />);
    const closeBtn = screen.getByRole('button', { name: /fechar filtros/i });
    // useFocusTrap with initialFocusRef=closeButtonRef moves focus to close button.
    expect(document.activeElement).toBe(closeBtn);
  });

  it('Tab at the last focusable element cycles focus to the first', () => {
    render(<LibraryFilterDrawer {...BASE_PROPS} />);
    const backdrop = screen.getByTestId('filter-drawer-backdrop');
    const closeBtn = screen.getByRole('button', { name: /fechar filtros/i });

    act(() => { closeBtn.focus(); });
    expect(document.activeElement).toBe(closeBtn);

    // The aside is the containerRef; keydown bubbles from closeBtn to aside.
    // Find the aside (dialog) to fire keydown on its container.
    const drawer = backdrop.querySelector('[role="dialog"]') as HTMLElement;
    fireEvent.keyDown(drawer, { key: 'Tab', bubbles: true });

    // Trap cycles back to the first (= only) focusable with stubbed rail.
    expect(document.activeElement).toBe(closeBtn);
  });

  it('restores focus to the opener element when the drawer unmounts', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open filters';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = render(<LibraryFilterDrawer {...BASE_PROPS} />);
    // Drawer has focus now; opener was recorded by the hook.
    expect(document.activeElement).not.toBe(opener);

    unmount();
    // Hook cleanup restores focus to the opener.
    expect(document.activeElement).toBe(opener);

    document.body.removeChild(opener);
  });
});
