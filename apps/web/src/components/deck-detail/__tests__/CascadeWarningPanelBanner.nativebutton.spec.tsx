/**
 * CascadeWarningPanelBanner — native button tests (T8, UXUI-03)
 *
 * Verifies that the collapsible banner header is a native <button> element
 * (not a div[role=button]), with proper aria-expanded/aria-controls and
 * keyboard-activated expand/collapse.
 *
 * T8 AC:
 *   - Header is `<button type="button">` with aria-expanded and aria-controls
 *   - Manual onKeyDown handler is gone; native button handles Space/Enter
 *   - Clicking the header toggles expanded state
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CascadeWarningPanelBanner } from '../CascadeWarningPanel';
import type { ICompositionDraft } from '../../../hooks/useCompositionDraft';
import type { ICascadeCheckResult, TCascadeReason } from '../../../hooks/useCascadeCheck';

const DRAFT: ICompositionDraft = {
  cards: [],
  heroIdentifier: 'katsu-the-wanderer-wtr',
  format: 'Classic Constructed',
};

function makeCascadeResult(count: number): ICascadeCheckResult {
  const idList = Array.from({ length: count }, (_, i) => `card-${i}`);
  const ids = new Set<string>(idList);
  const reasons = new Map<string, TCascadeReason>(idList.map((id) => [id, 'format']));
  return { illegalCardIds: ids, count, reasons };
}

describe('CascadeWarningPanelBanner — native button (T8)', () => {
  it('renders the header as a native <button type="button">', () => {
    render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(3)}
        onRemoveIllegal={() => undefined}
      />,
    );
    const header = screen.getByRole('button', { name: /podem ser ilegais/i });
    // The element must be a native button, not a div with role=button.
    expect(header.tagName).toBe('BUTTON');
    expect(header).toHaveAttribute('type', 'button');
  });

  it('header button carries aria-expanded and aria-controls', () => {
    render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(2)}
        onRemoveIllegal={() => undefined}
      />,
    );
    const header = screen.getByRole('button', { name: /podem ser ilegais/i });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(header).toHaveAttribute('aria-controls', 'cascade-banner-body');
  });

  it('toggles aria-expanded on click', async () => {
    render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(2)}
        onRemoveIllegal={() => undefined}
      />,
    );
    const header = screen.getByRole('button', { name: /podem ser ilegais/i });
    expect(header).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
  });

  it('native button activates on Space without a manual onKeyDown handler', async () => {
    render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(2)}
        onRemoveIllegal={() => undefined}
      />,
    );
    const header = screen.getByRole('button', { name: /podem ser ilegais/i });
    // Initially expanded — remove btn is visible
    expect(screen.getByTestId('cascade-remove-illegal-btn')).toBeInTheDocument();

    // Space on a native button triggers onClick — no custom onKeyDown needed.
    header.focus();
    await userEvent.keyboard(' ');

    // Collapsed → remove btn gone
    expect(screen.queryByTestId('cascade-remove-illegal-btn')).not.toBeInTheDocument();
  });

  it('header does NOT have role="button" attribute (native element, not ARIA role)', () => {
    render(
      <CascadeWarningPanelBanner
        draft={DRAFT}
        cascadeCheck={makeCascadeResult(1)}
        onRemoveIllegal={() => undefined}
      />,
    );
    const header = screen.getByRole('button', { name: /pode ser ilegal/i });
    // Native <button> — the implicit role comes from the element, not an explicit attribute.
    expect(header).not.toHaveAttribute('role', 'button');
  });
});
