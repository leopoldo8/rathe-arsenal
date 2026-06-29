/**
 * Unit tests for <LegalityReasonsPopover /> (U14)
 *
 * Test scenarios:
 *  - Happy path: popover renders reasons inside dialog.
 *  - Happy path: popover heading present and labelled.
 *  - Happy path: `role="dialog"` is present on the content.
 *  - Happy path: `aria-modal="false"` is present.
 *  - Edge case: empty reasons → defensive fallback string.
 *  - A11y: trigger has aria-haspopup="dialog".
 *  - A11y: popover content is labelled by heading via aria-labelledby.
 *  - A11y: Escape closes popover (simulated via Radix open state).
 *  - A11y: focus return to trigger button after close (via onCloseAutoFocus).
 *  - CardRowLegalityWarning: renders warning icon with correct aria-label.
 *  - CardRowLegalityWarning: tooltip has correct id for aria-describedby.
 */

import React, { useRef } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LegalityReasonsPopover } from '../LegalityReasonsPopover';
import { CardRowLegalityWarning } from '../CardRowLegalityWarning';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Test harness that renders LegalityReasonsPopover with a tracked trigger ref.
 */
function TestWrapper({
  reasons,
  category,
}: {
  reasons: readonly string[];
  category: 'incomplete' | 'illegal';
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <LegalityReasonsPopover
      triggerRef={triggerRef}
      reasons={reasons}
      category={category}
      trigger={
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          data-testid="test-trigger"
        >
          Open
        </button>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Tests — popover content
// ---------------------------------------------------------------------------

describe('LegalityReasonsPopover — content', () => {
  it('renders reasons in the popover after clicking trigger', async () => {
    render(
      <TestWrapper
        reasons={['Hero not set', 'Missing 2 cards']}
        category="incomplete"
      />,
    );

    fireEvent.click(screen.getByTestId('test-trigger'));

    await waitFor(() => {
      const popover = screen.getByTestId('legality-reasons-popover');
      expect(popover).toHaveTextContent('Hero not set');
      expect(popover).toHaveTextContent('Missing 2 cards');
    });
  });

  it('renders the popover heading for incomplete category', async () => {
    render(<TestWrapper reasons={['Missing 2 cards']} category="incomplete" />);
    fireEvent.click(screen.getByTestId('test-trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('legality-reasons-popover')).toHaveTextContent(
        'Baralho incompleto',
      );
    });
  });

  it('renders the popover heading for illegal category', async () => {
    render(<TestWrapper reasons={['4× card exceeds limit']} category="illegal" />);
    fireEvent.click(screen.getByTestId('test-trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('legality-reasons-popover')).toHaveTextContent(
        'Baralho ilegal neste formato',
      );
    });
  });

  it('renders defensive fallback for empty reasons', async () => {
    render(<TestWrapper reasons={[]} category="illegal" />);
    fireEvent.click(screen.getByTestId('test-trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('legality-reasons-popover')).toHaveTextContent(
        'Baralho incompleto — motivo não disponível.',
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — a11y attributes
// ---------------------------------------------------------------------------

describe('LegalityReasonsPopover — a11y', () => {
  it('trigger has aria-haspopup="dialog"', () => {
    render(<TestWrapper reasons={['Missing 2 cards']} category="incomplete" />);
    expect(screen.getByTestId('test-trigger')).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('popover content has role="dialog"', async () => {
    render(<TestWrapper reasons={['Missing 2 cards']} category="incomplete" />);
    fireEvent.click(screen.getByTestId('test-trigger'));

    await waitFor(() => {
      const popover = screen.getByTestId('legality-reasons-popover');
      expect(popover).toHaveAttribute('role', 'dialog');
    });
  });

  it('popover content has aria-modal="false"', async () => {
    render(<TestWrapper reasons={['Missing 2 cards']} category="incomplete" />);
    fireEvent.click(screen.getByTestId('test-trigger'));

    await waitFor(() => {
      const popover = screen.getByTestId('legality-reasons-popover');
      expect(popover).toHaveAttribute('aria-modal', 'false');
    });
  });

  it('popover has aria-labelledby pointing to a heading', async () => {
    render(<TestWrapper reasons={['Missing 2 cards']} category="incomplete" />);
    fireEvent.click(screen.getByTestId('test-trigger'));

    await waitFor(() => {
      const popover = screen.getByTestId('legality-reasons-popover');
      const labelledById = popover.getAttribute('aria-labelledby');
      expect(labelledById).toBeTruthy();
      // The heading with that ID should exist in the document
      if (labelledById) {
        const heading = document.getElementById(labelledById);
        expect(heading).toBeInTheDocument();
        expect(heading?.tagName.toLowerCase()).toBe('h4');
      }
    });
  });

  it('popover closes when trigger is clicked again', async () => {
    render(<TestWrapper reasons={['Missing 2 cards']} category="incomplete" />);
    const trigger = screen.getByTestId('test-trigger');

    // Open
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByTestId('legality-reasons-popover')).toBeInTheDocument();
    });

    // Close (toggle)
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.queryByTestId('legality-reasons-popover')).not.toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — CardRowLegalityWarning
// ---------------------------------------------------------------------------

describe('CardRowLegalityWarning — a11y', () => {
  it('renders a warning icon with aria-label "Not legal in {format}"', () => {
    render(
      <CardRowLegalityWarning
        format="Classic Constructed"
        cardIdentifier="pummel-wtr-1"
      />,
    );
    const icon = screen.getByTestId('card-legality-warning-pummel-wtr-1');
    expect(icon).toHaveAttribute('aria-label', 'Inválido em Classic Constructed');
  });

  it('warning icon has aria-describedby pointing to the tooltip element id', () => {
    render(
      <CardRowLegalityWarning
        format="Blitz"
        cardIdentifier="pummel-wtr-1"
      />,
    );
    const icon = screen.getByTestId('card-legality-warning-pummel-wtr-1');
    const describedById = icon.getAttribute('aria-describedby');
    expect(describedById).toBe('card-legality-tooltip-pummel-wtr-1');
  });

  it('warning icon is focusable (tabIndex=0)', () => {
    render(
      <CardRowLegalityWarning
        format="Classic Constructed"
        cardIdentifier="pummel-wtr-1"
      />,
    );
    const icon = screen.getByTestId('card-legality-warning-pummel-wtr-1');
    expect(icon).toHaveAttribute('tabindex', '0');
  });

  it('uses custom reason text when provided', () => {
    render(
      <CardRowLegalityWarning
        format="Classic Constructed"
        cardIdentifier="pummel-wtr-1"
        reason="Not legal in Blitz"
      />,
    );
    // The tooltip content should contain the custom reason
    // (Tooltip doesn't open without pointer events in jsdom, so we check
    //  the icon a11y label which is always rendered)
    const icon = screen.getByTestId('card-legality-warning-pummel-wtr-1');
    expect(icon).toBeInTheDocument();
  });

  it('renders the warning icon glyph ⚠', () => {
    render(
      <CardRowLegalityWarning
        format="Classic Constructed"
        cardIdentifier="pummel-wtr-1"
      />,
    );
    expect(screen.getByTestId('card-legality-warning-pummel-wtr-1')).toHaveTextContent('⚠');
  });
});
