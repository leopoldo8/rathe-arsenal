import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { IDeckDetailResponse } from '../../../api/deck-detail';

const h = vi.hoisted(() => ({
  linkProps: { current: null as null | Record<string, unknown> },
  detail: { current: {} as Record<string, unknown> },
  tags: { current: {} as Record<string, unknown> },
  refetch: vi.fn(),
  tagRowTags: { current: [] as readonly { id: number; name: string }[] },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ useParams: () => ({ deckId: '42' }) }),
  useNavigate: () => vi.fn(),
  Link: (props: Record<string, unknown> & { children: React.ReactNode }) => {
    h.linkProps.current = props;
    return (
      <a href="/mock" className={props['className'] as string} aria-label={props['aria-label'] as string}>
        {props.children}
      </a>
    );
  },
}));

vi.mock('../../../api/deck-detail', () => ({
  useDeckDetailQuery: () => h.detail.current,
}));

vi.mock('../../../api/tags', () => ({
  useTagsQuery: () => h.tags.current,
}));

vi.mock('../../../api/decks', () => ({
  usePatchDeckMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useUntrackDeckMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../../hooks/useNavigationAwayGuard', () => ({
  useNavigationAwayGuard: () => ({ bypassNext: vi.fn() }),
}));

vi.mock('../../../components/deck-detail/TagChipRow', () => ({
  TagChipRow: ({ tags }: { tags: readonly { id: number; name: string }[] }) => {
    h.tagRowTags.current = tags;
    return <div data-testid="tag-chip-row-mock" />;
  },
}));

vi.mock('../../../components/deck-detail/FormatDropdown', () => ({
  FormatDropdown: () => <div data-testid="format-dropdown-mock" />,
}));

import { DeckEditPage } from '../decks.$deckId_.edit';
import pageStyles from '../decks.$deckId_.edit.module.css';

function cls(name: string | undefined): string {
  if (!name) throw new Error('css module class is missing');
  return name;
}

const DECK = {
  id: 42,
  name: 'Rhinar Aggro',
  format: 'Classic Constructed',
  status: 'building',
  tags: ['torneio', 'liga local'],
  notes: 'Trocar o Flex',
} as unknown as IDeckDetailResponse;

beforeEach(() => {
  h.linkProps.current = null;
  h.refetch.mockReset();
  h.tagRowTags.current = [];
  h.detail.current = { isLoading: false, isError: false, data: DECK, refetch: h.refetch };
  h.tags.current = {
    data: {
      tags: [
        { id: 7, name: 'liga local', createdAt: '' },
        { id: 9, name: 'torneio', createdAt: '' },
      ],
    },
  };
});

describe('DeckEditPage', () => {
  it('centres the column and renders the form through the page', () => {
    const { container } = render(<DeckEditPage />);

    expect(container.firstElementChild).toHaveClass(cls(pageStyles.page));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Editar deck');
    expect(screen.getByTestId('deck-edit-name')).toHaveValue('Rhinar Aggro');
    expect(screen.getByTestId('deck-edit-notes')).toHaveValue('Trocar o Flex');
  });

  it('resolves the deck tag names to the user tag ids before handing them to the tag row', () => {
    render(<DeckEditPage />);
    expect(h.tagRowTags.current.map((t) => t.id)).toEqual([9, 7]);
  });

  it('links back to the deck with the router Link, not a bare anchor', () => {
    render(<DeckEditPage />);
    expect(h.linkProps.current).toMatchObject({
      to: '/decks/$deckId',
      params: { deckId: '42' },
    });
    expect(screen.getByRole('link', { name: /Voltar ao deck Rhinar Aggro/ })).toBeInTheDocument();
  });

  it('shows a loading placeholder and no form while the deck loads', () => {
    h.detail.current = { isLoading: true, isError: false, data: undefined, refetch: h.refetch };
    render(<DeckEditPage />);

    expect(screen.getByRole('status', { name: 'Carregando o deck' })).toBeInTheDocument();
    expect(screen.queryByTestId('deck-edit-panel')).not.toBeInTheDocument();
  });

  it('offers a retry when the deck fails to load', () => {
    h.detail.current = {
      isLoading: false,
      isError: true,
      error: new Error('offline'),
      data: undefined,
      refetch: h.refetch,
    };
    render(<DeckEditPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('offline');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(h.refetch).toHaveBeenCalledTimes(1);
  });
});
