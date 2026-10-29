import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IMarkSourceVersionsResponse, ISourceCopiesResponse } from '../../../api/collection-versions';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const markMutate = vi.fn();
const copiesState: { data: ISourceCopiesResponse | undefined } = { data: undefined };
const markState: { data: IMarkSourceVersionsResponse | undefined } = { data: undefined };

vi.mock('../../../api/collection-versions', async () => {
  const actual = await vi.importActual<typeof import('../../../api/collection-versions')>(
    '../../../api/collection-versions',
  );
  return {
    ...actual,
    useSourceCopiesQuery: () => ({ data: copiesState.data, isLoading: false, isError: false }),
    useMarkSourceVersionsMutation: () => ({
      mutate: (variables: unknown, options?: { onSuccess?: (data: IMarkSourceVersionsResponse) => void }) => {
        markMutate(variables);
        if (markState.data) options?.onSuccess?.(markState.data);
      },
      isPending: false,
      isError: false,
    }),
  };
});
vi.mock('../../../api/library', () => ({ useLibraryQuery: () => ({ data: undefined }) }));
vi.mock('../CardVersionsSheet', () => ({ CardVersionsSheet: () => null }));

import { VersionBulkSheet } from '../VersionBulkSheet';

const NO_VERSION = { printingCode: '', edition: '' as const, finish: '' as const, condition: '' as const };

const COPIES: ISourceCopiesResponse = {
  copies: 12,
  withoutVersion: 11,
  items: [
    { cardIdentifier: 'snatch-red', name: 'Snatch', pitch: 1, quantity: 3, ...NO_VERSION },
    { cardIdentifier: 'command-and-conquer-red', name: 'Command and Conquer', pitch: 1, quantity: 3, ...NO_VERSION },
    { cardIdentifier: 'enlightened-strike-red', name: 'Enlightened Strike', pitch: 1, quantity: 1, ...NO_VERSION, finish: 'rainbow' },
    { cardIdentifier: 'sink-below-yellow', name: 'Sink Below', pitch: 2, quantity: 2, ...NO_VERSION },
    { cardIdentifier: 'pack-hunt-blue', name: 'Pack Hunt', pitch: 3, quantity: 3, ...NO_VERSION },
  ],
};

function expectInOrder(root: HTMLElement, fragments: readonly string[]): void {
  // Each fragment must appear after the end of the one before it.
  const text = (root.textContent ?? '').replace(/\s+/g, ' ');
  let cursor = 0;
  const found: Array<[string, boolean]> = [];
  for (const fragment of fragments) {
    const at = text.indexOf(fragment, cursor);
    found.push([fragment, at >= 0]);
    if (at >= 0) cursor = at + fragment.length;
  }
  expect(found).toEqual(fragments.map((fragment) => [fragment, true]));
}

beforeEach(() => {
  markMutate.mockReset();
  copiesState.data = COPIES;
  markState.data = undefined;
});

describe('VersionBulkSheet', () => {
  it('matches r3-version-bulk-phone copy and order', () => {
    const { container } = render(<VersionBulkSheet sourceId="list" label="Lista colada em 21/10" />);

    expectInOrder(container, [
      'Importações',
      'Versões desta importação',
      'Lista colada em 21/10 · 12 cópias',
      'Marcar de uma vez',
      'Edição',
      '1ª edição',
      'Alpha',
      'Unlimited',
      'Não sei',
      'Edição: 1ª edição, Alpha ou Unlimited, escrito na carta',
      'Foil',
      'Sem foil',
      'Rainbow Foil',
      'Cold Foil',
      'Não sei',
      'Foil: o acabamento brilhante',
      'Estado',
      'NM',
      'LP',
      'MP',
      'HP',
      'Não sei',
      'Estado: NM quase nova, LP pouco usada, MP usada, HP muito usada',
      'Aplicar às 11 cópias sem versão',
      'As que você já marcou não mudam.',
      'Prévia',
      '3 Snatch (Vermelho)',
      'Mudar',
    ]);
    expect(screen.queryByRole('button', { name: 'DMG' })).not.toBeInTheDocument();
    const pressed = screen.getAllByRole('button').filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(pressed).toEqual([]);
    expect(screen.getAllByRole('button', { name: /^Mudar a versão de/ })).toHaveLength(5);
  });

  it('previews the marking and applies only to copies with no version', async () => {
    const user = userEvent.setup();
    markState.data = { applied: 10, skipped: ['sink-below-yellow'] };
    render(<VersionBulkSheet sourceId="list" label="Lista colada em 21/10" />);
    const apply = screen.getByRole('button', { name: 'Aplicar às 11 cópias sem versão' });
    expect(apply).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Sem foil' }));
    await user.click(screen.getByRole('button', { name: 'NM' }));

    expect(apply).toBeEnabled();
    const preview = screen.getByText('3 Snatch (Vermelho)').closest('ul')!;
    const rows = within(preview).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('3 Snatch (Vermelho)');
    expect(rows[0]).toHaveTextContent('Sem foil · NM');
    expect(rows[3]).toHaveTextContent('Sink Below (Amarelo)');
    expect(rows[3]).toHaveTextContent('Sem foil · NM');
    // The copy already marked keeps its own version.
    expect(rows[2]).toHaveTextContent('Rainbow Foil');
    expect(rows[2]).not.toHaveTextContent('Sem foil');

    await user.click(apply);

    expect(markMutate).toHaveBeenCalledWith({ sourceId: 'list', finish: 'none', condition: 'NM' });
  });

  it('lists the cards the marking skipped by name after applying', async () => {
    const user = userEvent.setup();
    markState.data = { applied: 9, skipped: ['sink-below-yellow', 'pack-hunt-blue'] };
    render(<VersionBulkSheet sourceId="list" label="Lista colada em 21/10" />);

    await user.click(screen.getByRole('button', { name: 'Sem foil' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar às 11 cópias sem versão' }));

    const skipped = await screen.findByRole('region', { name: /Ficaram como estavam/ });
    expect(within(skipped).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Sink Below (Amarelo)',
      'Pack Hunt (Azul)',
    ]);
  });
});
