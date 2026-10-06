import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { IDeckDetailResponse } from '../../../api/deck-detail';
import type { TDeckStatus } from '../../../api/decks';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  patchMutate: vi.fn(),
  patchPending: { value: false },
  untrackMutate: vi.fn(),
  untrackPending: { value: false },
  bypassNext: vi.fn(),
  guardOptions: { current: null as null | {
    isDirty: boolean;
    isEditMode: boolean;
    onBlock: (proceed: () => void, stay: () => void) => void;
  } },
  tagRowProps: { current: null as null | { deckId: number; tags: readonly { id: number; name: string }[] } },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => h.navigate,
}));

vi.mock('../../../api/decks', () => ({
  usePatchDeckMutation: () => ({ mutate: h.patchMutate, isPending: h.patchPending.value }),
  useUntrackDeckMutation: () => ({ mutate: h.untrackMutate, isPending: h.untrackPending.value }),
}));

vi.mock('../../../hooks/useNavigationAwayGuard', () => ({
  useNavigationAwayGuard: (options: NonNullable<typeof h.guardOptions.current>) => {
    h.guardOptions.current = options;
    return { bypassNext: h.bypassNext };
  },
}));

vi.mock('../../deck-detail/TagChipRow', () => ({
  TagChipRow: (props: { deckId: number; tags: readonly { id: number; name: string }[] }) => {
    h.tagRowProps.current = props;
    return <div data-testid="tag-chip-row-mock">{props.tags.map((t) => t.name).join(',')}</div>;
  },
}));

vi.mock('../../deck-detail/FormatDropdown', () => ({
  FormatDropdown: ({ value, onChange }: { value: string; onChange: (f: string) => void }) => (
    <select
      data-testid="format-dropdown-mock"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="Classic Constructed">Classic Constructed</option>
      <option value="Blitz">Blitz</option>
    </select>
  ),
}));

import { DeckEditForm } from '../DeckEditForm';
import panelStyles from '../DeckEditForm.module.css';

function cls(name: string | undefined): string {
  if (!name) throw new Error('css module class is missing');
  return name;
}

function makeDeck(overrides: Partial<IDeckDetailResponse> = {}): IDeckDetailResponse {
  return {
    id: 42,
    fabraryUlid: null,
    name: 'Rhinar Aggro',
    hero: 'Rhinar',
    heroIdentifier: 'rhinar-reckless-rampage',
    format: 'Classic Constructed',
    trackedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'building',
    tags: ['liga local'],
    notes: null,
    legality: { category: 'legal', reasons: [] },
    replacements: [],
    totalCards: 0,
    latestSnapshot: null,
    ...overrides,
  };
}

const TAGS = [{ id: 7, name: 'liga local', createdAt: '' }];

function renderForm(deck: IDeckDetailResponse = makeDeck()): ReturnType<typeof render> {
  return render(<DeckEditForm deck={deck} tags={TAGS} />);
}

function succeedNextPatch(): void {
  h.patchMutate.mockImplementation((_body, opts) => opts?.onSuccess?.());
}

beforeEach(() => {
  h.navigate.mockReset();
  h.patchMutate.mockReset();
  h.untrackMutate.mockReset();
  h.bypassNext.mockReset();
  h.patchPending.value = false;
  h.untrackPending.value = false;
  h.guardOptions.current = null;
  h.tagRowProps.current = null;
});

describe('DeckEditForm: fields (EDIT-02)', () => {
  it('pre-fills name, format, status and notes from the deck', () => {
    renderForm(makeDeck({ notes: 'Liga sexta', format: 'Blitz', status: 'active' }));

    expect(screen.getByTestId('deck-edit-name')).toHaveValue('Rhinar Aggro');
    expect(screen.getByTestId('format-dropdown-mock')).toHaveValue('Blitz');
    expect(screen.getByTestId('status-segment-active')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('deck-edit-notes')).toHaveValue('Liga sexta');
  });

  it('shows empty notes when the deck has none', () => {
    renderForm(makeDeck({ notes: null }));
    expect(screen.getByTestId('deck-edit-notes')).toHaveValue('');
  });

  it('labels every field', () => {
    renderForm();
    expect(screen.getByLabelText('Nome')).toBe(screen.getByTestId('deck-edit-name'));
    expect(screen.getByLabelText('Notas')).toBe(screen.getByTestId('deck-edit-notes'));
    expect(screen.getByRole('radiogroup', { name: 'Status do deck' })).toBeInTheDocument();
  });

  it('caps the name at 120 and the notes at 2000 characters, matching the API', () => {
    renderForm();
    expect(screen.getByTestId('deck-edit-name')).toHaveAttribute('maxlength', '120');
    expect(screen.getByTestId('deck-edit-notes')).toHaveAttribute('maxlength', '2000');
  });

  it('hands the tag row the real tag ids, not positions', () => {
    renderForm();
    expect(h.tagRowProps.current?.deckId).toBe(42);
    expect(h.tagRowProps.current?.tags).toEqual(TAGS);
  });

  it('draws the fields in the panel and the danger zone outside it', () => {
    renderForm();
    const panel = screen.getByTestId('deck-edit-panel');
    expect(panel).toHaveClass(cls(panelStyles.panel));
    expect(panel).toContainElement(screen.getByTestId('deck-edit-name'));
    expect(panel).toContainElement(screen.getByTestId('deck-edit-notes'));
    expect(panel).not.toContainElement(screen.getByTestId('deck-danger-zone'));
  });
});

describe('DeckEditForm: saving', () => {
  it('keeps Save disabled until something changes', () => {
    renderForm();
    expect(screen.getByTestId('deck-edit-save')).toBeDisabled();
    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Rhinar Control' } });
    expect(screen.getByTestId('deck-edit-save')).toBeEnabled();
  });

  it('sends only the changed name', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Rhinar Control' } });
    fireEvent.click(screen.getByTestId('deck-edit-save'));

    expect(h.patchMutate).toHaveBeenCalledTimes(1);
    expect(h.patchMutate.mock.calls[0]![0]).toEqual({ name: 'Rhinar Control' });
  });

  it('sends only the changed format', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('format-dropdown-mock'), { target: { value: 'Blitz' } });
    fireEvent.click(screen.getByTestId('deck-edit-save'));

    expect(h.patchMutate.mock.calls[0]![0]).toEqual({ format: 'Blitz' });
  });

  it('sends the notes text', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('deck-edit-notes'), { target: { value: 'Trocar o Flex' } });
    fireEvent.click(screen.getByTestId('deck-edit-save'));

    expect(h.patchMutate.mock.calls[0]![0]).toEqual({ notes: 'Trocar o Flex' });
  });

  it('sends null when saved notes are emptied', () => {
    renderForm(makeDeck({ notes: 'antigo' }));
    fireEvent.change(screen.getByTestId('deck-edit-notes'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('deck-edit-save'));

    expect(h.patchMutate.mock.calls[0]![0]).toEqual({ notes: null });
  });

  it.each<TDeckStatus>(['idea', 'building', 'ready', 'active', 'retired'])(
    'saves status %s through the segmented control',
    (status) => {
      const start: TDeckStatus = status === 'idea' ? 'active' : 'idea';
      renderForm(makeDeck({ status: start }));

      fireEvent.click(screen.getByTestId(`status-segment-${status}`));
      fireEvent.click(screen.getByTestId('deck-edit-save'));

      expect(h.patchMutate.mock.calls[0]![0]).toEqual({ status });
    },
  );

  it('blocks Save and explains why when the name is empty', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: '   ' } });

    expect(screen.getByTestId('deck-edit-save')).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Dê um nome ao deck.');
  });

  it('saves with Enter in the name field', () => {
    renderForm();
    const input = screen.getByTestId('deck-edit-name');
    fireEvent.change(input, { target: { value: 'Rhinar Control' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(h.patchMutate).toHaveBeenCalledTimes(1);
  });

  it('skips the unsaved-changes guard once, then returns to the deck, after a successful save', () => {
    succeedNextPatch();
    renderForm();
    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Rhinar Control' } });
    fireEvent.click(screen.getByTestId('deck-edit-save'));

    expect(h.bypassNext).toHaveBeenCalledTimes(1);
    expect(h.navigate).toHaveBeenCalledWith({
      to: '/decks/$deckId',
      params: { deckId: '42' },
      search: { edit: undefined },
    });
    expect(h.bypassNext.mock.invocationCallOrder[0]!).toBeLessThan(
      h.navigate.mock.invocationCallOrder[0]!,
    );
  });

  it('stays on the screen and shows an error when the save fails', () => {
    h.patchMutate.mockImplementation((_body, opts) => opts?.onError?.(new Error('boom')));
    renderForm();
    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Rhinar Control' } });
    fireEvent.click(screen.getByTestId('deck-edit-save'));

    expect(screen.getByTestId('deck-edit-save-error')).toHaveTextContent('Não foi possível salvar');
    expect(h.navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('deck-edit-name')).toHaveValue('Rhinar Control');
  });

  it('clears the save error as soon as the user edits again', () => {
    h.patchMutate.mockImplementation((_body, opts) => opts?.onError?.(new Error('boom')));
    renderForm();
    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Rhinar Control' } });
    fireEvent.click(screen.getByTestId('deck-edit-save'));
    fireEvent.change(screen.getByTestId('deck-edit-notes'), { target: { value: 'x' } });

    expect(screen.queryByTestId('deck-edit-save-error')).not.toBeInTheDocument();
  });

  it('disables Save while the request is in flight', () => {
    h.patchPending.value = true;
    renderForm();
    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Rhinar Control' } });
    expect(screen.getByTestId('deck-edit-save')).toBeDisabled();
    expect(screen.getByTestId('deck-edit-save')).toHaveTextContent('Salvando…');
  });
});

describe('DeckEditForm: leaving with unsaved changes', () => {
  it('arms the guard only when a field differs from the saved deck', () => {
    renderForm();
    expect(h.guardOptions.current?.isDirty).toBe(false);
    expect(h.guardOptions.current?.isEditMode).toBe(true);

    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Other' } });
    expect(h.guardOptions.current?.isDirty).toBe(true);

    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Rhinar Aggro' } });
    expect(h.guardOptions.current?.isDirty).toBe(false);
  });

  it('cancel goes back to the deck', () => {
    renderForm();
    fireEvent.click(screen.getByTestId('deck-edit-cancel'));
    expect(h.navigate).toHaveBeenCalledWith({
      to: '/decks/$deckId',
      params: { deckId: '42' },
      search: { edit: undefined },
    });
  });

  it('asks before discarding, counting the changed fields', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Other' } });
    fireEvent.change(screen.getByTestId('deck-edit-notes'), { target: { value: 'n' } });
    const proceed = vi.fn();
    const stay = vi.fn();

    React.act(() => h.guardOptions.current!.onBlock(proceed, stay));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Descartar 2 alterações?');
    expect(proceed).not.toHaveBeenCalled();
    expect(stay).not.toHaveBeenCalled();
  });

  it('keeps editing when the user chooses Keep editing', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Other' } });
    const proceed = vi.fn();
    const stay = vi.fn();
    React.act(() => h.guardOptions.current!.onBlock(proceed, stay));

    fireEvent.click(screen.getByTestId('discard-confirm-keep-btn'));

    expect(stay).toHaveBeenCalledTimes(1);
    expect(proceed).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('lets the navigation through when the user discards', () => {
    renderForm();
    fireEvent.change(screen.getByTestId('deck-edit-name'), { target: { value: 'Other' } });
    const proceed = vi.fn();
    const stay = vi.fn();
    React.act(() => h.guardOptions.current!.onBlock(proceed, stay));

    fireEvent.click(screen.getByTestId('discard-confirm-discard-btn'));

    expect(proceed).toHaveBeenCalledTimes(1);
    expect(stay).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('DeckEditForm: danger zone (EDIT-04)', () => {
  it('retires the deck with a status patch and shows it as retired', () => {
    succeedNextPatch();
    renderForm(makeDeck({ status: 'active' }));

    fireEvent.click(screen.getByTestId('deck-retire-btn'));

    expect(h.patchMutate.mock.calls[0]![0]).toEqual({ status: 'retired' });
    expect(screen.getByTestId('status-segment-retired')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows an error and leaves the status alone when retiring fails', () => {
    h.patchMutate.mockImplementation((_body, opts) => opts?.onError?.(new Error('boom')));
    renderForm(makeDeck({ status: 'active' }));

    fireEvent.click(screen.getByTestId('deck-retire-btn'));

    expect(within(screen.getByTestId('deck-danger-zone')).getByRole('alert')).toHaveTextContent(
      'Não foi possível aposentar',
    );
    expect(screen.getByTestId('status-segment-active')).toHaveAttribute('aria-checked', 'true');
  });

  it('disables Aposentar when the deck is already retired', () => {
    renderForm(makeDeck({ status: 'retired' }));
    expect(screen.getByTestId('deck-retire-btn')).toBeDisabled();
  });

  it('does not delete on the first click, it asks first', () => {
    renderForm();
    fireEvent.click(screen.getByTestId('deck-delete-btn'));

    expect(screen.getByRole('alertdialog')).toHaveTextContent('Excluir "Rhinar Aggro"?');
    expect(h.untrackMutate).not.toHaveBeenCalled();
  });

  it('keeps the deck when the confirmation is cancelled', () => {
    renderForm();
    fireEvent.click(screen.getByTestId('deck-delete-btn'));
    fireEvent.click(screen.getByTestId('deck-delete-cancel'));

    expect(h.untrackMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('deletes the deck once confirmed and goes back to Home', () => {
    h.untrackMutate.mockImplementation((_id, opts) => opts?.onSuccess?.());
    renderForm();
    fireEvent.click(screen.getByTestId('deck-delete-btn'));
    fireEvent.click(screen.getByTestId('deck-delete-confirm'));

    expect(h.untrackMutate).toHaveBeenCalledTimes(1);
    expect(h.untrackMutate.mock.calls[0]![0]).toBe(42);
    expect(h.navigate).toHaveBeenCalledWith({ to: '/home', search: { tag: [] } });
  });

  it('keeps the dialog open with an inline error when the delete fails', () => {
    h.untrackMutate.mockImplementation((_id, opts) => opts?.onError?.(new Error('boom')));
    renderForm();
    fireEvent.click(screen.getByTestId('deck-delete-btn'));
    fireEvent.click(screen.getByTestId('deck-delete-confirm'));

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByTestId('deck-delete-error')).toHaveTextContent('Não foi possível excluir');
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
