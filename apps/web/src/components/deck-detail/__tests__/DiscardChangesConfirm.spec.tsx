/**
 * Tests for DiscardChangesConfirm (U13).
 *
 * Covers:
 *  - Renders heading with N changes count
 *  - Renders body text
 *  - "Keep editing" calls onKeepEditing
 *  - "Discard changes" calls onDiscard
 *  - Escape calls onKeepEditing (safe default)
 *  - Default focus on "Keep editing" (prevents accidental Enter-to-destroy)
 *  - Tab order: Keep editing → Discard changes → loop
 *  - changeCount reflects literal value in heading
 *  - "change" vs "changes" plural
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscardChangesConfirm } from '../DiscardChangesConfirm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderConfirm(overrides: Partial<Parameters<typeof DiscardChangesConfirm>[0]> = {}) {
  const defaults = {
    open: true,
    changeCount: 3,
    onKeepEditing: vi.fn(),
    onDiscard: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<DiscardChangesConfirm {...props} />), props };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('DiscardChangesConfirm — rendering', () => {
  it('renders heading with N changes', () => {
    renderConfirm({ changeCount: 3 });
    expect(screen.getByText('Descartar 3 alterações?')).toBeInTheDocument();
  });

  it('uses singular "change" when changeCount is 1', () => {
    renderConfirm({ changeCount: 1 });
    expect(screen.getByText('Descartar 1 alteração?')).toBeInTheDocument();
  });

  it('renders body text', () => {
    renderConfirm();
    expect(screen.getByText('Suas edições não salvas neste baralho serão perdidas.')).toBeInTheDocument();
  });

  it('renders both buttons', () => {
    renderConfirm();
    expect(screen.getByTestId('discard-confirm-keep-btn')).toBeInTheDocument();
    expect(screen.getByTestId('discard-confirm-discard-btn')).toBeInTheDocument();
  });

  it('does not render when open is false', () => {
    renderConfirm({ open: false });
    expect(screen.queryByText(/Descartar/)).not.toBeInTheDocument();
  });

  it('reflects literal changeCount in heading (N=7)', () => {
    renderConfirm({ changeCount: 7 });
    expect(screen.getByText('Descartar 7 alterações?')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

describe('DiscardChangesConfirm — interactions', () => {
  it('calls onKeepEditing when Keep editing is clicked', async () => {
    const onKeepEditing = vi.fn();
    renderConfirm({ onKeepEditing });
    await userEvent.click(screen.getByTestId('discard-confirm-keep-btn'));
    expect(onKeepEditing).toHaveBeenCalledTimes(1);
  });

  it('calls onDiscard when Discard changes is clicked', async () => {
    const onDiscard = vi.fn();
    renderConfirm({ onDiscard });
    await userEvent.click(screen.getByTestId('discard-confirm-discard-btn'));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('calls onKeepEditing on Escape (safe default)', async () => {
    const onKeepEditing = vi.fn();
    renderConfirm({ onKeepEditing });
    await userEvent.keyboard('{Escape}');
    expect(onKeepEditing).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// A11y: default focus on "Keep editing"
// ---------------------------------------------------------------------------

describe('DiscardChangesConfirm — a11y: default focus', () => {
  it('places default focus on Keep editing button', async () => {
    renderConfirm();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByTestId('discard-confirm-keep-btn'),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// A11y: layout — Keep editing leftmost, Discard rightmost
// ---------------------------------------------------------------------------

describe('DiscardChangesConfirm — a11y: button layout', () => {
  it('Keep editing appears before Discard changes in DOM order', () => {
    renderConfirm();
    const footer = screen.getByTestId('discard-confirm-keep-btn').parentElement;
    const buttons = footer?.querySelectorAll('button') ?? [];
    expect(buttons[0]).toBe(screen.getByTestId('discard-confirm-keep-btn'));
    expect(buttons[1]).toBe(screen.getByTestId('discard-confirm-discard-btn'));
  });
});

// ---------------------------------------------------------------------------
// User story: 2 qty changes + hero swap = 3 changes in heading
// ---------------------------------------------------------------------------

describe('DiscardChangesConfirm — count heading reflects literal changeCount', () => {
  it('user changes 2 card quantities + swaps hero → changeCount=3 → heading reads "Discard 3 changes?"', () => {
    renderConfirm({ changeCount: 3 });
    expect(screen.getByRole('heading', { name: /Descartar 3 alterações\?/ })).toBeInTheDocument();
  });
});
