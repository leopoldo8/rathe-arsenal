import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { IDeckReplacement } from '../../../api/replacements';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { entry } from './deckDetailTestData';
import type { IDeckListItem } from '../deckListModel';

const mockApiFetch = vi.fn();
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => mockApiFetch };
});

import { DeckList } from '../DeckList';

const DECK_ID = 7;

function item(cardIdentifier: string, name: string, slot = 'mainboard'): IDeckListItem {
  return { key: `${cardIdentifier}::${slot}`, entry: entry({ cardIdentifier, name, slot }), quantity: 2, missing: 0 };
}

function replacement(overrides: Partial<IDeckReplacement> = {}): IDeckReplacement {
  return {
    id: 'replacement-1',
    slot: 'mainboard',
    originalCardIdentifier: 'emissary-of-tides-red',
    originalName: 'Emissary of Tides',
    replacementCardIdentifier: 'coax-a-commotion-red',
    quantity: 2,
    originalOwned: false,
    ...overrides,
  };
}

const ITEMS = [item('coax-a-commotion-red', 'Coax a Commotion'), item('flex-red', 'Flex')];

let client: QueryClient;

function renderList(replacements: readonly IDeckReplacement[]): void {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DeckList items={ITEMS} deckId={DECK_ID} replacements={replacements} />
    </QueryClientProvider>,
  );
}

const cellOf = (name: string): HTMLElement =>
  screen.getAllByTestId('deck-list-cell').find((cell) => cell.textContent?.includes(name))!;

beforeEach(() => {
  mockApiFetch.mockReset();
  mockApiFetch.mockResolvedValue({ replacement: {} });
});

describe('DeckList replacement marks', () => {
  it('marks a replacement with its original and Undo', async () => {
    await setTestLocale('en-US');
    renderList([replacement()]);

    const marked = cellOf('Coax a Commotion');
    expect(within(marked).getByTestId('replacement-mark')).toHaveTextContent('in place of Emissary of Tides');
    expect(within(marked).getByRole('button', { name: /undo/i })).toBeInTheDocument();

    const plain = cellOf('Flex');
    expect(within(plain).queryByTestId('replacement-mark')).toBeNull();
    expect(within(plain).queryByRole('button', { name: /undo/i })).toBeNull();
  });

  it('marks a replacement with its original and Undo: a name with punctuation shows as the catalog spells it', async () => {
    await setTestLocale('en-US');
    renderList([
      replacement({ originalCardIdentifier: 'a-moments-peace-blue', originalName: "A Moment's Peace" }),
    ]);

    const marked = cellOf('Coax a Commotion');
    expect(within(marked).getByTestId('replacement-mark')).toHaveTextContent("in place of A Moment's Peace");
    expect(within(marked).getByRole('button', { name: "Undo the replacement of A Moment's Peace" })).toBeInTheDocument();
  });

  it('Undo sends the revert', async () => {
    await setTestLocale('en-US');
    renderList([replacement()]);
    const spy = vi.spyOn(client, 'invalidateQueries');

    await userEvent.click(within(cellOf('Coax a Commotion')).getByRole('button', { name: /undo/i }));

    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/replacements/replacement-1/revert', { method: 'POST' }));
    await waitFor(() => {
      const keys = spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
      expect(keys).toContain(JSON.stringify(['deck-detail', String(DECK_ID)]));
      expect(keys).toContain(JSON.stringify(['swaps']));
    });
  });

  it('prompts keep or go back when the original is owned', async () => {
    await setTestLocale('en-US');
    renderList([replacement({ originalOwned: true })]);

    const prompt = within(cellOf('Coax a Commotion')).getByTestId('replacement-prompt');

    expect(prompt).toHaveTextContent('You now have the original');
    expect(within(prompt).getByRole('button', { name: /^keep/i })).toBeInTheDocument();
    expect(within(prompt).getByRole('button', { name: /^go back/i })).toBeInTheDocument();
  });

  it('shows no prompt while the original is not owned', () => {
    renderList([replacement({ originalOwned: false })]);

    expect(screen.queryByTestId('replacement-prompt')).toBeNull();
  });

  it('Go back and Keep send their routes', async () => {
    await setTestLocale('en-US');
    renderList([replacement({ originalOwned: true })]);
    const spy = vi.spyOn(client, 'invalidateQueries');
    const prompt = () => within(cellOf('Coax a Commotion')).getByTestId('replacement-prompt');

    await userEvent.click(within(prompt()).getByRole('button', { name: /^go back/i }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/replacements/replacement-1/revert', { method: 'POST' }));

    await userEvent.click(within(prompt()).getByRole('button', { name: /^keep/i }));
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledWith('/replacements/replacement-1/keep', { method: 'POST' }));

    const keys = spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys.filter((key) => key === JSON.stringify(['deck-detail', String(DECK_ID)]))).toHaveLength(2);
    expect(keys.filter((key) => key === JSON.stringify(['swaps']))).toHaveLength(2);
  });
});
