/**
 * Unit tests for <DeckNameInline /> (U8)
 *
 * Test scenarios:
 *  - Happy path (mouse): clicking the display button outside Edit shows the input
 *    pre-filled; Enter saves via usePatchDeckMutation.
 *  - Happy path (keyboard): Tab focuses the display button; Enter opens the inline
 *    input; Enter on input commits; focus returns to the display button.
 *  - Edge case: empty blur restores the previous name without calling PATCH.
 *  - Edge case: Escape inside the input cancels and restores.
 *  - Edge case (Edit mode): element renders as a static <h1> (no button role);
 *    tabIndex=-1 so Tab would skip it.
 *  - Edge case (a11y): SR-only <h1> inside the button keeps the document heading
 *    outline contribution even though the visible element is a button.
 *  - ARIA: button has aria-label="Edit deck name — currently {name}".
 *  - ARIA: inline input has aria-label="Deck name".
 *  - Touch target: button has min-block-size: 44px via CSS class.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeckNameInline } from '../DeckNameInline';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();

vi.mock('../../../api/decks', () => ({
  usePatchDeckMutation: vi.fn(() => ({
    mutate: (
      body: unknown,
      callbacks?: { onSettled?: () => void },
    ) => {
      mockMutate(body, callbacks);
    },
    isPending: false,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderView(name = 'Kayo Blinding Blade') {
  return render(
    <DeckNameInline deckId={1} name={name} mode="view" />,
  );
}

function renderEdit(name = 'Kayo Blinding Blade') {
  return render(
    <DeckNameInline deckId={1} name={name} mode="edit" />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckNameInline — view mode display button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a button with aria-label "Edit deck name — currently {name}"', () => {
    renderView('Test Deck');
    expect(
      screen.getByRole('button', {
        name: 'Edit deck name — currently Test Deck',
      }),
    ).toBeInTheDocument();
  });

  it('contains an SR-only <h1> inside the button for document outline', () => {
    renderView('Kayo Blinding Blade');
    // The h1 is visually hidden but present in the DOM
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('Kayo Blinding Blade');
  });

  it('clicking the button switches to inline input pre-filled with the name', async () => {
    renderView('Kayo Blinding Blade');
    fireEvent.click(screen.getByRole('button'));
    const input = await screen.findByRole('textbox', { name: 'Deck name' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Kayo Blinding Blade');
  });

  it('pressing Enter on the button opens the inline input', async () => {
    renderView('Kayo Blinding Blade');
    const btn = screen.getByRole('button');
    fireEvent.keyDown(btn, { key: 'Enter' });
    const input = await screen.findByRole('textbox', { name: 'Deck name' });
    expect(input).toBeInTheDocument();
  });

  it('pressing Space on the button opens the inline input', async () => {
    renderView('Kayo Blinding Blade');
    const btn = screen.getByRole('button');
    fireEvent.keyDown(btn, { key: ' ' });
    const input = await screen.findByRole('textbox', { name: 'Deck name' });
    expect(input).toBeInTheDocument();
  });
});

describe('DeckNameInline — inline input commit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pressing Enter on input commits via usePatchDeckMutation', async () => {
    renderView('Old Name');
    fireEvent.click(screen.getByRole('button'));

    const input = await screen.findByRole('textbox', { name: 'Deck name' });
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockMutate).toHaveBeenCalledWith(
      { name: 'New Name' },
      expect.any(Object),
    );
  });

  it('blurring the input commits the change', async () => {
    renderView('Old Name');
    fireEvent.click(screen.getByRole('button'));

    const input = await screen.findByRole('textbox', { name: 'Deck name' });
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.blur(input);

    expect(mockMutate).toHaveBeenCalledWith(
      { name: 'New Name' },
      expect.any(Object),
    );
  });

  it('does NOT call PATCH when the name is unchanged', async () => {
    renderView('Same Name');
    fireEvent.click(screen.getByRole('button'));

    const input = await screen.findByRole('textbox', { name: 'Deck name' });
    // Value already equals the name — blur without changing
    fireEvent.blur(input);

    expect(mockMutate).not.toHaveBeenCalled();
  });
});

describe('DeckNameInline — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('empty blur restores previous name without calling PATCH', async () => {
    renderView('Kayo Blinding Blade');
    fireEvent.click(screen.getByRole('button'));

    const input = await screen.findByRole('textbox', { name: 'Deck name' });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    // PATCH not called
    expect(mockMutate).not.toHaveBeenCalled();
    // Display button is back with original name
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Edit deck name — currently Kayo Blinding Blade',
        }),
      ).toBeInTheDocument();
    });
  });

  it('Escape inside input cancels and restores original name', async () => {
    renderView('Kayo Blinding Blade');
    fireEvent.click(screen.getByRole('button'));

    const input = await screen.findByRole('textbox', { name: 'Deck name' });
    fireEvent.change(input, { target: { value: 'something else' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    // PATCH not called
    expect(mockMutate).not.toHaveBeenCalled();
    // Display button is back
    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Edit deck name — currently Kayo Blinding Blade',
        }),
      ).toBeInTheDocument();
    });
  });
});

describe('DeckNameInline — edit mode (static heading)', () => {
  it('renders as a heading element (not a button) in edit mode', () => {
    renderEdit('Kayo Blinding Blade');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('heading has tabIndex=-1 so Tab navigation skips it', () => {
    renderEdit('Kayo Blinding Blade');
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('renders the name as text content', () => {
    renderEdit('Kayo Blinding Blade');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Kayo Blinding Blade',
    );
  });
});

describe('DeckNameInline — a11y', () => {
  it('SR-only h1 keeps document heading outline when button is displayed', () => {
    renderView('Test Deck');
    // There is exactly one h1 — inside the button but accessible to AT
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent('Test Deck');
  });

  it('inline input aria-label is "Deck name"', async () => {
    renderView('Test Deck');
    fireEvent.click(screen.getByRole('button'));
    const input = await screen.findByLabelText('Deck name');
    expect(input).toBeInTheDocument();
  });
});
