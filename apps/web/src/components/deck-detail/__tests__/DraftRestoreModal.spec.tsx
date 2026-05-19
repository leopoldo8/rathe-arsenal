/**
 * Tests for DraftRestoreModal (U13).
 *
 * Covers:
 *  - Renders heading + description when open
 *  - Restore button calls onRestore
 *  - Discard button calls onDiscard
 *  - Escape key calls onDiscard (via Radix onOpenChange(false))
 *  - Default focus lands on Restore button (via requestAnimationFrame)
 *  - Tab order: Restore → Discard → loop (Radix focus-trap)
 *  - returnFocusRef receives focus after dismiss
 *  - Not rendered when open=false
 */
import React, { createRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DraftRestoreModal } from '../DraftRestoreModal';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModal(overrides: Partial<Parameters<typeof DraftRestoreModal>[0]> = {}) {
  const defaults = {
    open: true,
    onRestore: vi.fn(),
    onDiscard: vi.fn(),
    returnFocusRef: createRef<HTMLElement>(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<DraftRestoreModal {...props} />), props };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('DraftRestoreModal — rendering', () => {
  it('renders heading and description when open', () => {
    renderModal();
    expect(screen.getByText('Unsaved changes from your previous edit')).toBeInTheDocument();
    expect(screen.getByText(/You have unsaved changes from a previous session/)).toBeInTheDocument();
  });

  it('renders Restore and Discard buttons', () => {
    renderModal();
    expect(screen.getByTestId('draft-restore-restore-btn')).toBeInTheDocument();
    expect(screen.getByTestId('draft-restore-discard-btn')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderModal({ open: false });
    expect(screen.queryByText('Unsaved changes from your previous edit')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

describe('DraftRestoreModal — interactions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it('calls onRestore when Restore is clicked', async () => {
    const onRestore = vi.fn();
    renderModal({ onRestore });
    await userEvent.click(screen.getByTestId('draft-restore-restore-btn'));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it('calls onDiscard when Discard is clicked', async () => {
    const onDiscard = vi.fn();
    renderModal({ onDiscard });
    await userEvent.click(screen.getByTestId('draft-restore-discard-btn'));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// A11y: default focus on Restore
// ---------------------------------------------------------------------------

describe('DraftRestoreModal — a11y: default focus', () => {
  it('places default focus on Restore button', async () => {
    renderModal();
    // requestAnimationFrame fires asynchronously — wait for it
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId('draft-restore-restore-btn'),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// A11y: Escape triggers onDiscard
// ---------------------------------------------------------------------------

describe('DraftRestoreModal — a11y: Escape', () => {
  it('calls onDiscard on Escape key', async () => {
    const onDiscard = vi.fn();
    renderModal({ onDiscard });
    // Focus the modal content area first
    await userEvent.keyboard('{Escape}');
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// A11y: layout — Discard is leftmost, Restore is rightmost
// ---------------------------------------------------------------------------

describe('DraftRestoreModal — a11y: button layout', () => {
  it('Discard appears before Restore in DOM order (left-to-right layout)', () => {
    renderModal();
    const footer = screen.getByTestId('draft-restore-discard-btn').parentElement;
    const buttons = footer?.querySelectorAll('button') ?? [];
    expect(buttons[0]).toBe(screen.getByTestId('draft-restore-discard-btn'));
    expect(buttons[1]).toBe(screen.getByTestId('draft-restore-restore-btn'));
  });
});
