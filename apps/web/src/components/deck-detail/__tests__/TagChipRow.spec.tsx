/**
 * Unit tests for <TagChipRow /> (U8)
 *
 * Test scenarios:
 *  - Happy path: clicking × removes the tag; usePatchDeckMutation called.
 *  - XSS: chip name containing a script payload from a tampered payload is
 *    rendered as escaped text (no script execution); test asserts the rendered
 *    DOM text matches the literal string and no <script> element is created.
 *  - "+ add tag" button mounts the TagAutocompleteCombobox when clicked.
 *  - ARIA: chip remove button has aria-label="Remove tag {name}".
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagChipRow } from '../TagChipRow';
import type { ITagResponse } from '../../../api/tags';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();

vi.mock('../../../api/decks', () => ({
  usePatchDeckMutation: vi.fn(() => ({
    mutate: mockMutate,
    isPending: false,
  })),
}));

// Mock TagAutocompleteCombobox to keep tests focused on TagChipRow
vi.mock('../TagAutocompleteCombobox', () => ({
  TagAutocompleteCombobox: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="tag-combobox">
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TAG_LIGA: ITagResponse = { id: 1, name: 'liga local', createdAt: '2024-01-01T00:00:00Z' };
const TAG_COMP: ITagResponse = { id: 2, name: 'competitivo', createdAt: '2024-01-01T00:00:00Z' };
const XSS_TAG: ITagResponse = {
  id: 99,
  name: '<script>alert("xss")</script>',
  createdAt: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TagChipRow — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all tag names as text', () => {
    render(<TagChipRow deckId={1} tags={[TAG_LIGA, TAG_COMP]} />);
    expect(screen.getByText('liga local')).toBeInTheDocument();
    expect(screen.getByText('competitivo')).toBeInTheDocument();
  });

  it('clicking × calls usePatchDeckMutation with removeTagIds', () => {
    render(<TagChipRow deckId={1} tags={[TAG_LIGA]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover tag liga local' }));
    expect(mockMutate).toHaveBeenCalledWith({ removeTagIds: [1] });
  });

  it('each chip remove button has the correct aria-label', () => {
    render(<TagChipRow deckId={1} tags={[TAG_LIGA, TAG_COMP]} />);
    expect(
      screen.getByRole('button', { name: 'Remover tag liga local' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remover tag competitivo' }),
    ).toBeInTheDocument();
  });

  it('renders an "+ add tag" button when no combobox is open', () => {
    render(<TagChipRow deckId={1} tags={[]} />);
    expect(
      screen.getByRole('button', { name: 'Adicionar uma tag a este baralho' }),
    ).toBeInTheDocument();
  });

  it('clicking "+ add tag" mounts the TagAutocompleteCombobox', () => {
    render(<TagChipRow deckId={1} tags={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar uma tag a este baralho' }));
    expect(screen.getByTestId('tag-combobox')).toBeInTheDocument();
  });

  it('closing the combobox unmounts it and restores the add button', () => {
    render(<TagChipRow deckId={1} tags={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar uma tag a este baralho' }));
    // Close the combobox via the mock's close button
    fireEvent.click(screen.getByText('close'));
    expect(screen.queryByTestId('tag-combobox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Adicionar uma tag a este baralho' }),
    ).toBeInTheDocument();
  });
});

describe('TagChipRow — XSS defense', () => {
  it('renders a tag name containing a script payload as escaped text, no <script> element created', () => {
    render(<TagChipRow deckId={1} tags={[XSS_TAG]} />);

    // The exact literal string is rendered as text content
    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();

    // No <script> element is injected into the DOM
    expect(document.querySelectorAll('script')).toHaveLength(0);
  });

  it('remove button aria-label for XSS payload renders as literal text', () => {
    render(<TagChipRow deckId={1} tags={[XSS_TAG]} />);
    // React escapes attribute values — the raw string is used
    const removeBtn = screen.getByRole('button', {
      name: `Remover tag ${XSS_TAG.name}`,
    });
    expect(removeBtn).toBeInTheDocument();
  });
});

describe('TagChipRow — empty state', () => {
  it('renders only the add button when tags array is empty', () => {
    render(<TagChipRow deckId={1} tags={[]} />);
    const addBtn = screen.getByRole('button', { name: 'Adicionar uma tag a este baralho' });
    expect(addBtn).toBeInTheDocument();
  });
});
