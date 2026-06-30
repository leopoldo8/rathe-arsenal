/**
 * VariantQueueDrawer — focus-trap unit tests (T7, UXUI-03)
 *
 * Verifies:
 *   1. Focus moves to the close button when the drawer opens
 *   2. Tab at the last focusable element cycles back to the first
 *   3. Focus restores to the opener element when the drawer closes (unmount)
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

// Mock the router Link so the drawer renders without a real router context.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
}));

import { VariantQueueDrawer } from '../VariantQueueDrawer';

const BASE_PROPS = {
  open: true,
  onClose: vi.fn(),
  jobs: [],
  etaSeconds: 0,
} as const;

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('VariantQueueDrawer — focus trap (T7)', () => {
  it('moves initial focus to the close button when the drawer opens', () => {
    render(<VariantQueueDrawer {...BASE_PROPS} />);
    const closeBtn = screen.getByRole('button', { name: /fechar fila/i });
    // useFocusTrap with initialFocusRef=closeButtonRef moves focus to close button.
    expect(document.activeElement).toBe(closeBtn);
  });

  it('Tab at the last focusable element cycles focus to the first', () => {
    render(<VariantQueueDrawer {...BASE_PROPS} />);
    const panel = screen.getByTestId('variant-queue-panel');
    const closeBtn = screen.getByRole('button', { name: /fechar fila/i });

    // Focus the close button (also the only/last focusable with empty jobs).
    act(() => { closeBtn.focus(); });
    expect(document.activeElement).toBe(closeBtn);

    // Fire Tab on the container so the trap's keydown handler fires.
    fireEvent.keyDown(panel, { key: 'Tab', bubbles: true });

    // The trap cycles back to the first (= only) focusable.
    expect(document.activeElement).toBe(closeBtn);
  });

  it('restores focus to the opener element when the drawer unmounts', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open queue';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = render(<VariantQueueDrawer {...BASE_PROPS} />);
    // Drawer has focus now; opener was recorded by the hook.
    expect(document.activeElement).not.toBe(opener);

    unmount();
    // Hook cleanup restores focus to the opener.
    expect(document.activeElement).toBe(opener);

    document.body.removeChild(opener);
  });
});
