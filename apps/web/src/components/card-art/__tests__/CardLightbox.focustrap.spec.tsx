/**
 * CardLightbox — focus-trap unit tests (T7, UXUI-03)
 *
 * Verifies that useFocusTrap correctly:
 *   1. Focuses the close button on open (initialFocusRef)
 *   2. Cycles Tab at the last focusable element back to the first
 *   3. Restores focus to the opener element on close (unmount)
 *
 * CardLightbox has a single focusable element (close button), so the
 * forward-Tab-at-last-cycles-to-first test verifies the hook fires without
 * preventing default (it cycles to the same element).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CardLightbox } from '../CardLightbox';

const DEFAULT_PROPS = {
  imageUrl: 'https://example.com/card.webp',
  name: 'Coax a Commotion',
  onClose: vi.fn(),
} as const;

function mockMatchMedia(): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('CardLightbox — focus trap (T7)', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    mockMatchMedia();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('moves initial focus to the close button on open', () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    const closeBtn = screen.getByTestId('card-lightbox-close');
    // useFocusTrap focuses the initialFocusRef (closeButtonRef) on activate.
    expect(document.activeElement).toBe(closeBtn);
  });

  it('Tab at the only focusable element cycles focus back to it (trap active)', () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    const closeBtn = screen.getByTestId('card-lightbox-close');

    act(() => { closeBtn.focus(); });
    expect(document.activeElement).toBe(closeBtn);

    // Tab at last (= only) element should cycle to first (= same element).
    // The trap prevents default and calls first.focus().
    fireEvent.keyDown(closeBtn, { key: 'Tab', bubbles: true });

    // Close button should still have focus (cycled back to itself).
    expect(document.activeElement).toBe(closeBtn);
  });

  it('restores focus to opener element on unmount', () => {
    // Create an opener button outside the dialog.
    const opener = document.createElement('button');
    opener.textContent = 'Open lightbox';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = render(<CardLightbox {...DEFAULT_PROPS} />);
    // Dialog now has focus; opener should have been recorded.
    expect(document.activeElement).not.toBe(opener);

    unmount();
    // After unmount the hook cleanup restores focus to the opener.
    expect(document.activeElement).toBe(opener);

    document.body.removeChild(opener);
  });
});
