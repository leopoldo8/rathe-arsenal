/**
 * OnboardingSkeleton test suite — Unit 4
 *
 * Covers:
 *  - Happy path: renders a step-1 StepIndicator + content placeholders
 *  - A11y: wrapper carries aria-busy="true" and aria-live="polite"
 *  - A11y: step indicator announces "Step 1 of 3"
 *  - Skeleton primitives are present with descriptive aria-labels
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingSkeleton } from '../OnboardingSkeleton';

describe('OnboardingSkeleton — happy path', () => {
  it('renders without throwing', () => {
    expect(() => render(<OnboardingSkeleton />)).not.toThrow();
  });

  it('renders the step indicator at step 1', () => {
    render(<OnboardingSkeleton />);
    const nav = screen.getByRole('navigation', { name: /step 1 of 3/i });
    expect(nav).toBeInTheDocument();
  });

  it('step 1 item is marked as current step', () => {
    render(<OnboardingSkeleton />);
    const currentStep = screen.getByRole('listitem', { name: /step 1 of 3: paste deck, current/i });
    expect(currentStep).toHaveAttribute('aria-current', 'step');
  });

  it('renders skeleton placeholder elements with aria-label attributes', () => {
    render(<OnboardingSkeleton />);
    expect(screen.getByRole('status', { name: /loading step heading/i })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading deck url input/i })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading primary action/i })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /loading secondary action/i })).toBeInTheDocument();
  });
});

describe('OnboardingSkeleton — a11y', () => {
  it('wrapper section carries aria-busy="true"', () => {
    render(<OnboardingSkeleton />);
    const wrapper = screen.getByRole('region', { name: /loading onboarding/i });
    expect(wrapper).toHaveAttribute('aria-busy', 'true');
  });

  it('wrapper section carries aria-live="polite"', () => {
    render(<OnboardingSkeleton />);
    const wrapper = screen.getByRole('region', { name: /loading onboarding/i });
    expect(wrapper).toHaveAttribute('aria-live', 'polite');
  });
});

describe('OnboardingSkeleton — reduced motion (prefers-reduced-motion)', () => {
  it('skeleton primitives are present regardless of motion preference', () => {
    // The Skeleton primitive itself handles prefers-reduced-motion via CSS
    // (animation: none; background-image: none). OnboardingSkeleton simply
    // composes those primitives — so we only verify the primitives render.
    render(<OnboardingSkeleton />);
    const statuses = screen.getAllByRole('status');
    expect(statuses.length).toBeGreaterThanOrEqual(5);
  });
});
