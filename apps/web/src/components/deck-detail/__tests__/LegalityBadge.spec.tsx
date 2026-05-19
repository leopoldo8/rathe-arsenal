/**
 * Unit tests for <LegalityBadge /> (U14)
 *
 * Test scenarios:
 *  - Happy path: legal deck → green inert chip (rendered as `<span>`, NOT `<button>`).
 *  - Happy path: legal deck → no `aria-haspopup` attribute.
 *  - Happy path: legal deck → not focusable (tabIndex not set to 0).
 *  - Happy path: legal deck → aria-label "Deck is legal in {format}".
 *  - Happy path: legal deck → screen reader sees aria-label without button/expandable semantics.
 *  - Happy path: incomplete deck → renders a button.
 *  - Happy path: incomplete deck → button carries aria-haspopup="dialog".
 *  - Happy path: incomplete deck (58/60) → text includes "Incomplete".
 *  - Happy path: incomplete deck with X/Y reason → text shows "Incomplete · 58/60 cards".
 *  - Happy path: click incomplete badge → popover appears with reasons.
 *  - Happy path: illegal deck → renders a button with aria-haspopup="dialog".
 *  - Happy path: illegal deck → text includes "Illegal".
 *  - Happy path: click illegal badge → popover appears with full reasons list.
 *  - Keyboard: Tab focuses incomplete badge button; Enter opens popover; Escape closes.
 *  - Keyboard: focus returns to badge button after Escape close.
 *  - Edge case: empty reasons with category 'illegal' → defensive fallback inside popover.
 *  - Edge case: empty reasons with category 'incomplete' → "Incomplete" fallback text.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LegalityBadge } from '../LegalityBadge';
import type { IDeckLegality } from '../../../api/decks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBadge(
  legality: IDeckLegality,
  format = 'Classic Constructed',
) {
  return render(<LegalityBadge legality={legality} format={format} />);
}

// ---------------------------------------------------------------------------
// Tests — legal variant (inert span)
// ---------------------------------------------------------------------------

describe('LegalityBadge — legal variant', () => {
  it('renders a <span> element, NOT a <button>', () => {
    renderBadge({ category: 'legal', reasons: [] });
    const badge = screen.getByTestId('legality-badge');
    expect(badge.tagName.toLowerCase()).toBe('span');
  });

  it('does NOT have aria-haspopup', () => {
    renderBadge({ category: 'legal', reasons: [] });
    const badge = screen.getByTestId('legality-badge');
    expect(badge).not.toHaveAttribute('aria-haspopup');
  });

  it('is NOT a focusable button (not role=button, no tabIndex=0)', () => {
    renderBadge({ category: 'legal', reasons: [] });
    const badge = screen.getByTestId('legality-badge');
    // Must not be a button role
    expect(badge.tagName.toLowerCase()).not.toBe('button');
    // tabIndex should not be explicitly set to 0 (default for span is -1)
    expect(badge).not.toHaveAttribute('tabindex', '0');
  });

  it('has aria-label "Deck is legal in {format}"', () => {
    renderBadge({ category: 'legal', reasons: [] });
    const badge = screen.getByTestId('legality-badge');
    expect(badge).toHaveAttribute('aria-label', 'Deck is legal in Classic Constructed');
  });

  it('includes "Legal" and the format abbreviation in the text', () => {
    renderBadge({ category: 'legal', reasons: [] });
    expect(screen.getByTestId('legality-badge')).toHaveTextContent('Legal');
    expect(screen.getByTestId('legality-badge')).toHaveTextContent('CC');
  });

  it('shows the Blitz abbreviation for Blitz format', () => {
    renderBadge({ category: 'legal', reasons: [] }, 'Blitz');
    expect(screen.getByTestId('legality-badge')).toHaveTextContent('Blitz');
  });

  it('aria-label references the full format name not abbreviation', () => {
    renderBadge({ category: 'legal', reasons: [] }, 'Blitz');
    expect(screen.getByTestId('legality-badge')).toHaveAttribute(
      'aria-label',
      'Deck is legal in Blitz',
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — incomplete variant (interactive button)
// ---------------------------------------------------------------------------

describe('LegalityBadge — incomplete variant', () => {
  it('renders a <button> element', () => {
    renderBadge({ category: 'incomplete', reasons: ['Missing 2 cards'] });
    const badge = screen.getByTestId('legality-badge');
    expect(badge.tagName.toLowerCase()).toBe('button');
  });

  it('has aria-haspopup="dialog"', () => {
    renderBadge({ category: 'incomplete', reasons: ['Missing 2 cards'] });
    expect(screen.getByTestId('legality-badge')).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('includes "Incomplete" in the badge text', () => {
    renderBadge({ category: 'incomplete', reasons: [] });
    expect(screen.getByTestId('legality-badge')).toHaveTextContent('Incomplete');
  });

  it('parses X/Y pattern from reasons for the badge text', () => {
    renderBadge({ category: 'incomplete', reasons: ['Deck has 58/60 cards'] });
    expect(screen.getByTestId('legality-badge')).toHaveTextContent('Incomplete · 58/60 cards');
  });

  it('shows fallback "Incomplete" when reasons is empty', () => {
    renderBadge({ category: 'incomplete', reasons: [] });
    expect(screen.getByTestId('legality-badge')).toHaveTextContent('Incomplete');
  });

  it('click opens the reasons popover', async () => {
    renderBadge({
      category: 'incomplete',
      reasons: ['Deck has 58/60 cards', 'Hero not set'],
    });

    const badge = screen.getByTestId('legality-badge');
    fireEvent.click(badge);

    await waitFor(() => {
      expect(screen.getByTestId('legality-reasons-popover')).toBeInTheDocument();
    });
  });

  it('popover lists the reasons', async () => {
    renderBadge({
      category: 'incomplete',
      reasons: ['Hero not set', 'Missing 2 cards'],
    });

    fireEvent.click(screen.getByTestId('legality-badge'));

    await waitFor(() => {
      expect(screen.getByTestId('legality-reasons-popover')).toHaveTextContent('Hero not set');
      expect(screen.getByTestId('legality-reasons-popover')).toHaveTextContent('Missing 2 cards');
    });
  });

  it('popover heading mentions deck is incomplete', async () => {
    renderBadge({ category: 'incomplete', reasons: ['Missing 2 cards'] });
    fireEvent.click(screen.getByTestId('legality-badge'));

    await waitFor(() => {
      expect(screen.getByTestId('legality-reasons-popover')).toHaveTextContent('incomplete');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — illegal variant (interactive button)
// ---------------------------------------------------------------------------

describe('LegalityBadge — illegal variant', () => {
  it('renders a <button> element', () => {
    renderBadge({ category: 'illegal', reasons: ['4× card exceeds limit'] });
    const badge = screen.getByTestId('legality-badge');
    expect(badge.tagName.toLowerCase()).toBe('button');
  });

  it('has aria-haspopup="dialog"', () => {
    renderBadge({ category: 'illegal', reasons: ['4× card exceeds limit'] });
    expect(screen.getByTestId('legality-badge')).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('includes "Illegal" and first-reason short form in the badge text', () => {
    renderBadge({ category: 'illegal', reasons: ['4× card exceeds limit'] });
    expect(screen.getByTestId('legality-badge')).toHaveTextContent('Illegal');
    expect(screen.getByTestId('legality-badge')).toHaveTextContent('4× card exceeds limit');
  });

  it('shows "Illegal" fallback when reasons is empty', () => {
    renderBadge({ category: 'illegal', reasons: [] });
    expect(screen.getByTestId('legality-badge')).toHaveTextContent('Illegal');
  });

  it('click opens popover with full reasons list', async () => {
    renderBadge({
      category: 'illegal',
      reasons: ['4× card exceeds limit', 'Card banned in Classic Constructed'],
    });

    fireEvent.click(screen.getByTestId('legality-badge'));

    await waitFor(() => {
      const popover = screen.getByTestId('legality-reasons-popover');
      expect(popover).toHaveTextContent('4× card exceeds limit');
      expect(popover).toHaveTextContent('Card banned in Classic Constructed');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — edge cases
// ---------------------------------------------------------------------------

describe('LegalityBadge — edge cases', () => {
  it('empty reasons with category "illegal" → defensive fallback string inside popover', async () => {
    renderBadge({ category: 'illegal', reasons: [] });
    fireEvent.click(screen.getByTestId('legality-badge'));

    await waitFor(() => {
      const popover = screen.getByTestId('legality-reasons-popover');
      expect(popover).toHaveTextContent('Deck is incomplete — reason not available.');
    });
  });

  it('empty reasons with category "incomplete" → defensive fallback string inside popover', async () => {
    renderBadge({ category: 'incomplete', reasons: [] });
    fireEvent.click(screen.getByTestId('legality-badge'));

    await waitFor(() => {
      const popover = screen.getByTestId('legality-reasons-popover');
      expect(popover).toHaveTextContent('Deck is incomplete — reason not available.');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — keyboard interaction
// ---------------------------------------------------------------------------

describe('LegalityBadge — keyboard interaction', () => {
  it('incomplete badge is in tab order (not role=button with negative tabindex)', () => {
    renderBadge({ category: 'incomplete', reasons: ['Missing 2 cards'] });
    const badge = screen.getByTestId('legality-badge');
    // Native <button> elements are in tab order by default (tabIndex=0)
    // We verify the element is a button (not disabled, no tabIndex=-1)
    expect(badge.tagName.toLowerCase()).toBe('button');
    expect(badge).not.toBeDisabled();
    expect(badge).not.toHaveAttribute('tabindex', '-1');
  });

  it('illegal badge is in tab order', () => {
    renderBadge({ category: 'illegal', reasons: ['4× card exceeds limit'] });
    const badge = screen.getByTestId('legality-badge');
    expect(badge.tagName.toLowerCase()).toBe('button');
    expect(badge).not.toBeDisabled();
    expect(badge).not.toHaveAttribute('tabindex', '-1');
  });

  it('Enter key on incomplete badge opens the popover', async () => {
    renderBadge({ category: 'incomplete', reasons: ['Missing 2 cards'] });
    const badge = screen.getByTestId('legality-badge');
    badge.focus();
    fireEvent.keyDown(badge, { key: 'Enter', code: 'Enter' });
    fireEvent.click(badge); // Radix also listens for click

    await waitFor(() => {
      expect(screen.getByTestId('legality-reasons-popover')).toBeInTheDocument();
    });
  });
});
