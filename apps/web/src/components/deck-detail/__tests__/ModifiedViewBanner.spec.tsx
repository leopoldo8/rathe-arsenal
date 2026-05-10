/**
 * Unit tests for <ModifiedViewBanner /> (R26)
 *
 * Test scenarios from Unit 16 plan:
 *  - Renders when rejectedCount > 0
 *  - Correct singular/plural label
 *  - "Clear rejections" button calls onClearRejections
 *  - Button disabled + aria-busy when isClearing=true
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModifiedViewBanner } from '../ModifiedViewBanner';

describe('ModifiedViewBanner', () => {
  it('renders with the correct singular label for 1 rejection', () => {
    render(
      <ModifiedViewBanner
        rejectedCount={1}
        onClearRejections={vi.fn()}
        isClearing={false}
      />,
    );
    expect(screen.getByText(/rejected 1 swap/i)).toBeInTheDocument();
  });

  it('renders with the correct plural label for multiple rejections', () => {
    render(
      <ModifiedViewBanner
        rejectedCount={3}
        onClearRejections={vi.fn()}
        isClearing={false}
      />,
    );
    expect(screen.getByText(/rejected 3 swaps/i)).toBeInTheDocument();
  });

  it('calls onClearRejections when the button is clicked', () => {
    const onClearRejections = vi.fn();
    render(
      <ModifiedViewBanner
        rejectedCount={2}
        onClearRejections={onClearRejections}
        isClearing={false}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /clear rejections/i }));
    expect(onClearRejections).toHaveBeenCalledTimes(1);
  });

  it('disables the button and sets aria-busy when isClearing=true', () => {
    render(
      <ModifiedViewBanner
        rejectedCount={2}
        onClearRejections={vi.fn()}
        isClearing={true}
      />,
    );
    const btn = screen.getByRole('button', { name: /clearing/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('renders as a status region for screen reader announcements', () => {
    render(
      <ModifiedViewBanner
        rejectedCount={1}
        onClearRejections={vi.fn()}
        isClearing={false}
      />,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows "Modified view." strong label', () => {
    render(
      <ModifiedViewBanner
        rejectedCount={1}
        onClearRejections={vi.fn()}
        isClearing={false}
      />,
    );
    expect(screen.getByText('Modified view.')).toBeInTheDocument();
  });
});
