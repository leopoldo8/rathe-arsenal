/**
 * Unit tests for <TagAutocompleteCombobox /> (U8)
 *
 * Test scenarios:
 *  - Happy path filter: typing "lig" filters to "liga local"; Enter attaches.
 *  - Happy path Create: typing a novel name → "Create [name]" is last item;
 *    Enter creates + attaches; input clears.
 *  - Keyboard: ArrowDown/ArrowUp navigate options; Enter selects.
 *  - Keyboard: Escape closes the combobox (calls onClose).
 *  - Edge case: Escape calls onClose without attaching.
 *  - Edge case: existing tag already attached → not shown in list.
 *  - Error 422: create fails with 422 → friendly inline error; dropdown stays open.
 *  - Error 5xx create: create fails 5xx → inline error + Retry button.
 *  - Error partial failure: create succeeded, PATCH failed → new tag in list + inline error.
 *  - Error 5xx attach existing: PATCH addTagIds 5xx → inline error; dropdown stays open.
 *  - Errors clear on user input.
 *  - ARIA: role="combobox", aria-controls, aria-expanded, aria-activedescendant.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagAutocompleteCombobox } from '../TagAutocompleteCombobox';
import type { ITagResponse } from '../../../api/tags';

// ---------------------------------------------------------------------------
// Mock state — mutable objects so vi.mock closures pick up changes
// ---------------------------------------------------------------------------

const MOCK_TAGS: ITagResponse[] = [
  { id: 1, name: 'liga local', createdAt: '2024-01-01T00:00:00Z' },
  { id: 2, name: 'competitivo', createdAt: '2024-01-01T00:00:00Z' },
  { id: 3, name: 'experimental', createdAt: '2024-01-01T00:00:00Z' },
];

// Mutable config objects — tests mutate these to control mock behavior
const createConfig: {
  behavior: 'success' | '422' | '5xx';
  newTag: ITagResponse | null;
} = { behavior: 'success', newTag: null };

const patchConfig: { behavior: 'success' | '5xx' } = { behavior: 'success' };

// Captured call spies
const spies = {
  create: vi.fn(),
  patch: vi.fn(),
};

vi.mock('../../../api/tags', () => ({
  useTagsQuery: vi.fn(() => ({ data: { tags: MOCK_TAGS } })),
  useCreateTagMutation: vi.fn(() => ({
    mutate: (body: { name: string }, callbacks?: {
      onSuccess?: (tag: ITagResponse) => void;
      onError?: (err: unknown) => void;
    }) => {
      spies.create(body, callbacks);
      const newTag = createConfig.newTag ?? { id: 99, name: body.name, createdAt: '' };
      if (createConfig.behavior === 'success') {
        callbacks?.onSuccess?.(newTag);
      } else if (createConfig.behavior === '422') {
        callbacks?.onError?.({ status: 422 });
      } else {
        callbacks?.onError?.({ status: 500 });
      }
    },
    isPending: false,
  })),
}));

vi.mock('../../../api/decks', () => ({
  usePatchDeckMutation: vi.fn(() => ({
    mutate: (body: unknown, callbacks?: {
      onSuccess?: () => void;
      onError?: (err: unknown) => void;
    }) => {
      spies.patch(body, callbacks);
      if (patchConfig.behavior === 'success') {
        callbacks?.onSuccess?.();
      } else {
        callbacks?.onError?.({ status: 500 });
      }
    },
    isPending: false,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderCombobox(existingTagIds: number[] = [], onClose = vi.fn()) {
  return render(
    <TagAutocompleteCombobox
      deckId={42}
      existingTagIds={existingTagIds}
      onClose={onClose}
    />,
  );
}

function getInput() {
  return screen.getByRole('combobox');
}

// ---------------------------------------------------------------------------
// Tests — ARIA wiring
// ---------------------------------------------------------------------------

describe('TagAutocompleteCombobox — ARIA wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.create.mockReset();
    spies.patch.mockReset();
    createConfig.behavior = 'success';
    createConfig.newTag = null;
    patchConfig.behavior = 'success';
  });

  it('input has role="combobox"', () => {
    renderCombobox();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('input aria-expanded is true when tags are available (query = "")', () => {
    renderCombobox();
    const input = getInput();
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('input aria-controls points to the listbox id', () => {
    renderCombobox();
    const input = getInput();
    const listboxId = input.getAttribute('aria-controls');
    expect(listboxId).toBeTruthy();
    expect(document.getElementById(listboxId!)).toBeInTheDocument();
  });

  it('listbox has role="listbox"', () => {
    renderCombobox();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('aria-activedescendant matches the highlighted option id after ArrowDown', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'lig' } });
    fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
    const input = getInput();
    const descId = input.getAttribute('aria-activedescendant');
    expect(descId).toBeTruthy();
    const option = document.getElementById(descId!);
    expect(option).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — happy filter + attach
// ---------------------------------------------------------------------------

describe('TagAutocompleteCombobox — happy filter + attach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.create.mockReset();
    spies.patch.mockReset();
    createConfig.behavior = 'success';
    createConfig.newTag = null;
    patchConfig.behavior = 'success';
  });

  it('typing "lig" shows only "liga local"', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'lig' } });
    expect(screen.getByText('liga local')).toBeInTheDocument();
    expect(screen.queryByText('competitivo')).not.toBeInTheDocument();
  });

  it('Enter on the first filtered option attaches the tag via PATCH', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'lig' } });
    fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(spies.patch).toHaveBeenCalledWith(
      { addTagIds: [1] },
      expect.any(Object),
    );
  });

  it('already-attached tags are excluded from the list', () => {
    renderCombobox([1]); // tag id 1 = "liga local" already attached
    fireEvent.change(getInput(), { target: { value: 'lig' } });
    expect(screen.queryByText('liga local')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — Create flow
// ---------------------------------------------------------------------------

describe('TagAutocompleteCombobox — Create flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.create.mockReset();
    spies.patch.mockReset();
    createConfig.behavior = 'success';
    createConfig.newTag = null;
    patchConfig.behavior = 'success';
  });

  it('shows Create option when typed value has no exact match', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'novaTag' } });
    expect(screen.getByText(/Criar/i)).toBeInTheDocument();
  });

  it('does NOT show Create option when typed value exactly matches an existing tag', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'liga local' } });
    expect(screen.queryByText(/Criar/i)).not.toBeInTheDocument();
  });

  it('clicking Create option calls useCreateTagMutation then usePatchDeckMutation', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'novaTag' } });
    const createOption = screen.getByText(/Criar/i).closest('[role="option"]')!;
    fireEvent.pointerDown(createOption);
    expect(spies.create).toHaveBeenCalledWith(
      { name: 'novaTag' },
      expect.any(Object),
    );
    expect(spies.patch).toHaveBeenCalledWith(
      { addTagIds: [99] },
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — Keyboard navigation
// ---------------------------------------------------------------------------

describe('TagAutocompleteCombobox — keyboard navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.create.mockReset();
    spies.patch.mockReset();
    createConfig.behavior = 'success';
    createConfig.newTag = null;
    patchConfig.behavior = 'success';
  });

  it('ArrowDown moves highlight to first option', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'lig' } });
    fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
    const input = getInput();
    const descId = input.getAttribute('aria-activedescendant');
    expect(descId).toMatch(/-opt-0$/);
  });

  it('ArrowUp on the first item goes back to no highlight (-1)', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'lig' } });
    fireEvent.keyDown(getInput(), { key: 'ArrowDown' });
    fireEvent.keyDown(getInput(), { key: 'ArrowUp' });
    expect(getInput()).not.toHaveAttribute('aria-activedescendant');
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    renderCombobox([], onClose);
    fireEvent.keyDown(getInput(), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests — Error states
// ---------------------------------------------------------------------------

describe('TagAutocompleteCombobox — error 422 (tag cap)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.create.mockReset();
    spies.patch.mockReset();
    createConfig.behavior = '422';
    createConfig.newTag = null;
    patchConfig.behavior = 'success';
  });

  it('shows the 200-cap inline error when POST returns 422', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'novaTag' } });
    const createOption = screen.getByText(/Criar/i).closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(createOption); });
    expect(screen.getByText(/limite de 200 tags/i)).toBeInTheDocument();
  });

  it('dropdown stays open after 422 error', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'novaTag' } });
    const createOption = screen.getByText(/Criar/i).closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(createOption); });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('typed text is preserved after 422 error', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'novaTag' } });
    const createOption = screen.getByText(/Criar/i).closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(createOption); });
    expect(getInput()).toHaveValue('novaTag');
  });
});

describe('TagAutocompleteCombobox — error 5xx create', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.create.mockReset();
    spies.patch.mockReset();
    createConfig.behavior = '5xx';
    createConfig.newTag = null;
    patchConfig.behavior = 'success';
  });

  it('shows 5xx inline error message', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'novaTag' } });
    const createOption = screen.getByText(/Criar/i).closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(createOption); });
    expect(screen.getByText(/não foi possível criar a tag/i)).toBeInTheDocument();
  });

  it('shows Retry button after 5xx create error', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'novaTag' } });
    const createOption = screen.getByText(/Criar/i).closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(createOption); });
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('clicking Retry re-fires useCreateTagMutation', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'novaTag' } });
    const createOption = screen.getByText(/Criar/i).closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(createOption); });
    act(() => { fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i })); });
    // createMutate should have been called again (total 2 times)
    expect(spies.create).toHaveBeenCalledTimes(2);
  });
});

describe('TagAutocompleteCombobox — error partial failure (create ok, attach fails)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.create.mockReset();
    spies.patch.mockReset();
    createConfig.behavior = 'success';
    createConfig.newTag = { id: 50, name: 'novaTag', createdAt: '' };
    patchConfig.behavior = '5xx';
  });

  it('shows partial-failure inline error when PATCH after create fails', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'novaTag' } });
    const createOption = screen.getByText(/Criar/i).closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(createOption); });
    expect(screen.getByText(/não foi possível anexar/i)).toBeInTheDocument();
  });

  it('after partial failure, new tag appears in the filtered list for retry', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'novaTag' } });
    const createOption = screen.getByText(/Criar/i).closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(createOption); });
    // The newly created tag name should be visible in the listbox
    const options = screen.getAllByRole('option');
    const hasNovaTag = options.some((opt) => opt.textContent?.includes('novaTag'));
    expect(hasNovaTag).toBe(true);
  });
});

describe('TagAutocompleteCombobox — error 5xx attach existing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.create.mockReset();
    spies.patch.mockReset();
    createConfig.behavior = 'success';
    createConfig.newTag = null;
    patchConfig.behavior = '5xx';
  });

  it('shows attach-error message when PATCH for existing tag fails', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'lig' } });
    const ligaOption = screen.getByText('liga local').closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(ligaOption); });
    expect(screen.getByText(/não foi possível anexar a tag/i)).toBeInTheDocument();
  });

  it('dropdown stays open after 5xx attach error', () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'lig' } });
    const ligaOption = screen.getByText('liga local').closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(ligaOption); });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});

describe('TagAutocompleteCombobox — errors clear on input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    spies.create.mockReset();
    spies.patch.mockReset();
    createConfig.behavior = 'success';
    createConfig.newTag = null;
    patchConfig.behavior = '5xx';
  });

  it('typing again clears the attach error', async () => {
    renderCombobox();
    fireEvent.change(getInput(), { target: { value: 'lig' } });
    const ligaOption = screen.getByText('liga local').closest('[role="option"]')!;
    act(() => { fireEvent.pointerDown(ligaOption); });
    expect(screen.getByText(/não foi possível anexar a tag/i)).toBeInTheDocument();
    // Type again — error should clear
    act(() => {
      fireEvent.change(getInput(), { target: { value: 'liga loc' } });
    });
    await waitFor(() => {
      expect(screen.queryByText(/não foi possível anexar a tag/i)).not.toBeInTheDocument();
    });
  });
});
