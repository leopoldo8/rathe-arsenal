/**
 * CardLightbox unit tests — Unit 8 (O3: prefers-reduced-motion assertion)
 *
 * Focus: motion-collapse behavior under prefers-reduced-motion: reduce.
 *
 * The CardLightbox has two motion features:
 *   1. Backdrop fadeIn animation (CSS: .backdrop { animation: fadeIn ... }).
 *   2. Perspective tilt on mouse-move (JS: handleMouseMove → setCssVar).
 *
 * Under prefers-reduced-motion: reduce:
 *   - CSS: .backdrop animation is set to `none`, .card transition is `none`
 *     and transform is overridden to `none !important` (CardLightbox.module.css).
 *   - JS: prefersReducedMotion.current is set to true in the useEffect, so
 *     handleMouseMove returns early — no tilt state updates fire.
 *
 * Note: CSS @media (prefers-reduced-motion) effects cannot be tested in jsdom
 * because JSDOM does not compute CSS. The structural tests below verify:
 *   - The component renders correctly under either motion preference.
 *   - The `prefersReducedMotion.current` ref is populated from matchMedia at
 *     mount time, ensuring the JS guard works at runtime.
 *   - The component's accessibility contract (role="dialog", aria-modal) is
 *     maintained regardless of motion preference.
 *
 * The CSS-level suppression (animation: none on .backdrop, transition: none on
 * .card) is the authoritative source of truth enforced by the stylesheet; it is
 * tested via visual regression (U8 dark-desktop baseline) rather than jsdom
 * computed styles.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardLightbox } from '../CardLightbox';

// ---------------------------------------------------------------------------
// Default props
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
  imageUrl: 'https://example.com/card.webp',
  name: 'Coax a Commotion',
  onClose: vi.fn(),
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockMatchMedia(prefersReducedMotion: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? prefersReducedMotion : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// ---------------------------------------------------------------------------
// Tests — happy path
// ---------------------------------------------------------------------------

describe('CardLightbox — happy path', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    mockMatchMedia(false);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders with role="dialog" and aria-modal', () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('renders the card name as aria-label on the dialog', () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    expect(screen.getByRole('dialog', { name: DEFAULT_PROPS.name })).toBeInTheDocument();
  });

  it('renders close button with accessible label', () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    const closeBtn = screen.getByRole('button', { name: /fechar visualização em tela cheia/i });
    expect(closeBtn).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<CardLightbox {...DEFAULT_PROPS} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /fechar visualização em tela cheia/i }));
    // The button's onClick fires AND the click bubbles to the backdrop's onClick.
    // Both call onClose — this is the component's designed behavior (no stopPropagation
    // on the button, since both the button and backdrop have the same dismiss action).
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<CardLightbox {...DEFAULT_PROPS} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('card-lightbox-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not propagate clicks on the card element to the backdrop', () => {
    const onClose = vi.fn();
    render(<CardLightbox {...DEFAULT_PROPS} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('card-lightbox-card'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders the caption with the card name', () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    // The <p> caption is aria-hidden; query by text content directly.
    const captions = document.querySelectorAll('[aria-hidden="true"]');
    const captionEl = Array.from(captions).find(
      (el) => el.textContent === DEFAULT_PROPS.name,
    );
    expect(captionEl).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests — prefers-reduced-motion (O3 plan requirement)
// ---------------------------------------------------------------------------

describe('CardLightbox — prefers-reduced-motion: reduce', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    // Set reduced-motion preference to true before render.
    // CardLightbox reads this in a useEffect on mount.
    mockMatchMedia(true);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders the dialog element correctly under reduced motion', () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('reads matchMedia at mount time to check prefers-reduced-motion', () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    // Verify matchMedia was called with the reduced-motion query.
    // This confirms the JS tilt-guard reads the preference at mount.
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('does not change tilt CSS vars on mouse-move when motion is reduced', () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    const card = screen.getByTestId('card-lightbox-card');

    // Capture the tilt state before mouse-move. The component initialises tilt
    // to { x: 0, y: 0 } and the tilt-effect sets --tilt-x / --tilt-y to '0deg'
    // on mount. Under reduced motion the mousemove handler returns early so
    // these values must not change.
    const tiltXBefore = card.style.getPropertyValue('--tilt-x');
    const tiltYBefore = card.style.getPropertyValue('--tilt-y');

    // Simulate a mouse-move over the card. Under reduced motion the handler
    // should return early without updating tilt state.
    fireEvent.mouseMove(card, { clientX: 300, clientY: 100 });

    // Values must not have changed — the handler short-circuits when
    // prefersReducedMotion.current is true.
    expect(card.style.getPropertyValue('--tilt-x')).toBe(tiltXBefore);
    expect(card.style.getPropertyValue('--tilt-y')).toBe(tiltYBefore);
  });

  it('is fully accessible regardless of motion preference', () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    expect(screen.getByRole('button', { name: /fechar visualização em tela cheia/i })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: DEFAULT_PROPS.name })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — normal motion (ensures tilt vars ARE set when motion is enabled)
// ---------------------------------------------------------------------------

describe('CardLightbox — normal motion (prefers-reduced-motion: no-preference)', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    mockMatchMedia(false); // no reduced-motion preference
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('applies --tilt-x and --tilt-y CSS vars on mouse-move when motion is enabled', async () => {
    render(<CardLightbox {...DEFAULT_PROPS} />);
    const card = screen.getByTestId('card-lightbox-card');

    // Mock getBoundingClientRect so the tilt calculation has a stable reference box.
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 400, height: 560,
      right: 400, bottom: 560, x: 0, y: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseMove(card, { clientX: 300, clientY: 100 });

    // --tilt-x and --tilt-y should be non-empty (e.g. "Xdeg") after the move.
    const tiltX = card.style.getPropertyValue('--tilt-x');
    const tiltY = card.style.getPropertyValue('--tilt-y');
    expect(tiltX).toMatch(/^-?[\d.]+deg$/);
    expect(tiltY).toMatch(/^-?[\d.]+deg$/);
  });
});
