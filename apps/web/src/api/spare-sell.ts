import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authFetch } from '../lib/auth-fetch';
import type { IListLinkState } from './shared-lists';
import type { ICardList, IAddLineBody } from './lists';
import { listsQueryKey } from './lists';
import { SPARE_QUERY_KEY } from './spare';

export interface ISellListInput {
  readonly name: string;
  readonly lines: readonly IAddLineBody[];
  readonly closingLine: string;
}

export interface ISellListSent {
  readonly listId: number;
  /** The address of the shared list, with no preview version on it yet. */
  readonly url: string;
}

interface IProgress {
  listId: number | null;
  linesAdded: boolean;
  link: IListLinkState | null;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

/**
 * Creates the sell list of a draft: the list, one line per chosen version, its share link, and the closing line on the
 * account. A step that failed is retried alone: the steps already done are remembered, so a second try never makes a
 * second list.
 */
export function useSendSellList(): (input: ISellListInput) => Promise<ISellListSent> {
  const queryClient = useQueryClient();
  const progress = useRef<IProgress>({ listId: null, linesAdded: false, link: null });

  return async function send(input: ISellListInput): Promise<ISellListSent> {
    const state = progress.current;
    if (state.listId === null) {
      const list = await authFetch<ICardList>('/lists', { method: 'POST', ...json({ kind: 'sell', name: input.name }) });
      state.listId = list.id;
    }
    if (!state.linesAdded) {
      for (const line of input.lines) {
        await authFetch<ICardList>(`/lists/${state.listId}/lines`, { method: 'POST', ...json(line) });
      }
      state.linesAdded = true;
    }
    if (state.link === null) {
      state.link = await authFetch<IListLinkState>(`/lists/${state.listId}/share`, { method: 'POST', ...json({}) });
    }
    await authFetch<{ text: string }>('/users/me/sell-closing-line', { method: 'PATCH', ...json({ text: input.closingLine }) });
    void queryClient.invalidateQueries({ queryKey: listsQueryKey, exact: true });
    void queryClient.invalidateQueries({ queryKey: SPARE_QUERY_KEY });
    return { listId: state.listId, url: state.link.url };
  };
}
