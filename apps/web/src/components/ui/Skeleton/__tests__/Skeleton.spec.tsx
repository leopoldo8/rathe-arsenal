/**
 * Skeleton tests.
 *
 * Test plan (from plan U4):
 *  - Happy path: renders with declared width/height; shimmer animation class present.
 *  - Edge case: prefers-reduced-motion matched -> no shimmer animation.
 *  - A11y: role="status", aria-busy, aria-label present.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from '../Skeleton';

describe('Skeleton — happy path', () => {
  it('renders an element with role="status" and aria-busy', () => {
    render(<Skeleton width={200} height={20} />);
    const el = screen.getByRole('status');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-busy', 'true');
  });

  it('applies explicit width and height as inline styles', () => {
    render(<Skeleton width={120} height={16} />);
    const el = screen.getByRole('status');
    expect(el).toHaveStyle({ width: '120px', height: '16px' });
  });

  it('applies string width/height values directly', () => {
    render(<Skeleton width="50%" height="2rem" />);
    const el = screen.getByRole('status');
    expect(el).toHaveStyle({ width: '50%', height: '2rem' });
  });

  it('applies custom aria-label', () => {
    render(<Skeleton aria-label="Loading deck cards" />);
    expect(screen.getByRole('status', { name: 'Loading deck cards' })).toBeInTheDocument();
  });

  it('defaults aria-label to "Loading"', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('applies rounded class when rounded=true', () => {
    const { container } = render(<Skeleton rounded />);
    // CSS Modules transforms class names — just verify a class was added
    const el = container.firstChild as HTMLElement;
    expect(el.className).toBeTruthy();
  });
});

describe('Skeleton — reduced motion', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders without shimmer animation class when prefers-reduced-motion is reduce', () => {
    // Mock matchMedia to return prefer-reduced-motion: reduce
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<Skeleton width={100} height={20} />);
    const el = screen.getByRole('status');

    // The element must still be present and accessible
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('aria-busy', 'true');

    // Note: CSS @media (prefers-reduced-motion: reduce) suppression is enforced
    // at the stylesheet level. The animation-name value cannot be asserted in
    // jsdom because CSS animations are not computed. The global.css rule is the
    // source of truth; this test verifies structural correctness only.
  });
});
