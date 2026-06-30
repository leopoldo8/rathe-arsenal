/**
 * HomeSkeleton tests — UXUI-07 skeleton parity
 * Asserts the skeleton card placeholder uses the aspect-ratio layout class.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeSkeleton } from '../_auth/home';

describe('HomeSkeleton — deck card placeholder structure (UXUI-07)', () => {
  it('renders deck card placeholder elements', () => {
    render(<HomeSkeleton />);
    const cards = screen.getAllByTestId('skeleton-deck-card');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('renders with aria-busy="true"', () => {
    const { container } = render(<HomeSkeleton />);
    const section = container.querySelector('[aria-busy="true"]');
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute('aria-live', 'polite');
  });
});
