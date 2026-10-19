import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ICardList, IPriceSuggestion } from '../../../api/lists';
import { createFakeApi, renderWithProviders, type IFakeApi } from '../../shared-deck/__tests__/sharingTestKit';
import { makeLine, makeList } from './listsTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../api/catalog', () => ({
  useSearchCardsQuery: () => ({ data: undefined, isSuccess: false, isFetching: false }),
}));

import { ListEditor } from '../ListEditor';

const SUGGESTION: IPriceSuggestion = { cents: 1400, approximate: false, fetchedAt: '2026-10-18T20:05:00.000Z', printing: 'WTR206.R' };

let api: IFakeApi;
let current: ICardList;

function serve(list: ICardList): void {
  current = list;
  api.handlers.set('GET /lists/7', () => current);
  api.handlers.set('GET /lists/7/printings/pummel-red', () => [
    { printing: 'WTR206.R', label: 'WTR206 · Normal', suggestion: SUGGESTION },
    { printing: 'WTR206.R.F', label: 'WTR206 · Rainbow Foil', suggestion: null },
  ]);
}

beforeEach(() => {
  api = createFakeApi();
  apiRef.current = api;
});

async function openPanel(user: ReturnType<typeof userEvent.setup>, name: RegExp): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByTestId('line-panel');
}

describe('list prices', () => {
  it('shows the suggestion under the price with its date, the approximate mark and the empty case', async () => {
    serve(
      makeList({
        lines: [
          makeLine({ id: 1, suggestion: SUGGESTION }),
          makeLine({ id: 2, cardIdentifier: 'snatch-red', name: 'Snatch', suggestion: { ...SUGGESTION, cents: 900, approximate: true } }),
          makeLine({ id: 3, cardIdentifier: 'remembrance', name: 'Remembrance', pitch: null, suggestion: null }),
        ],
      }),
    );
    api.handlers.set('GET /lists/7/printings/snatch-red', () => []);
    api.handlers.set('GET /lists/7/printings/remembrance', () => []);
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    let panel = await openPanel(user, /Editar Pummel/);
    expect(within(panel).getByText('Sugestão R$ 14')).toBeInTheDocument();
    expect(within(panel).getByText('mercado TCGplayer de 18/10')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    panel = await openPanel(user, /Editar Snatch/);
    expect(within(panel).getByText('Sugestão R$ 9')).toBeInTheDocument();
    expect(within(panel).getByText(/aproximado/)).toBeInTheDocument();
    await user.keyboard('{Escape}');

    panel = await openPanel(user, /Editar Remembrance/);
    expect(within(panel).getByTestId('suggestion-none')).toHaveTextContent('sem sugestão');
    expect(within(panel).queryByRole('button', { name: 'Usar sugestão' })).toBeNull();
  });

  it('uses the suggestion of one card', async () => {
    serve(makeList({ lines: [makeLine({ id: 1, suggestion: SUGGESTION })] }));
    api.handlers.set('POST /lists/7/apply-suggestions', ({ body }) => {
      expect(body).toEqual({ lineIds: [1] });
      current = { ...current, lines: [makeLine({ id: 1, suggestion: SUGGESTION, priceCents: 1400 })] };
      return current;
    });
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    const panel = await openPanel(user, /Editar Pummel/);
    await user.click(within(panel).getByRole('button', { name: 'Usar sugestão' }));
    await waitFor(() => expect(within(panel).getByLabelText('Preço cada (opcional)')).toHaveValue('R$ 14,00'));
  });

  it('shows each printing with its suggestion in the picker', async () => {
    serve(makeList({ lines: [makeLine({ id: 1 })] }));
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    const panel = await openPanel(user, /Editar Pummel/);
    expect(await within(panel).findByRole('option', { name: 'WTR206 · Normal · R$ 14' })).toBeInTheDocument();
    expect(within(panel).getByRole('option', { name: 'WTR206 · Rainbow Foil · sem sugestão' })).toBeInTheDocument();
  });

  it('uses every suggestion at list level and leaves the button off when there is none', async () => {
    serve(makeList({ lines: [makeLine({ id: 1, suggestion: SUGGESTION }), makeLine({ id: 2, name: 'Snatch', suggestion: null })] }));
    api.handlers.set('POST /lists/7/apply-suggestions', ({ body }) => {
      expect(body).toEqual({});
      current = { ...current, lines: current.lines.map((line) => (line.suggestion ? { ...line, priceCents: 1400 } : line)) };
      return current;
    });
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    await user.click(await screen.findByRole('button', { name: 'Usar sugestões em todas' }));
    await waitFor(() => expect(api.calls.some((call) => call.key === 'POST /lists/7/apply-suggestions')).toBe(true));
    await waitFor(() => expect(screen.getByText('R$ 14,00')).toBeInTheDocument());
  });

  it('disables use-all when no card has a suggestion', async () => {
    serve(makeList({ lines: [makeLine({ id: 1, suggestion: null })] }));
    renderWithProviders(<ListEditor listId="7" />);
    expect(await screen.findByRole('button', { name: 'Usar sugestões em todas' })).toBeDisabled();
  });

  it('edits the multiplier and clears it when emptied', async () => {
    serve(makeList({ priceMultiplier: 7, lines: [makeLine({ id: 1 })] }));
    api.handlers.set('PATCH /lists/7', ({ body }) => {
      current = { ...current, priceMultiplier: (body as { priceMultiplier: number | null }).priceMultiplier };
      return current;
    });
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    const field = await screen.findByLabelText('Multiplicador');
    expect(field).toHaveValue('7');
    await user.clear(field);
    await user.type(field, '6,5');
    await user.tab();
    await waitFor(() => expect(screen.getByLabelText('Multiplicador')).toHaveValue('6.5'));
    await user.clear(screen.getByLabelText('Multiplicador'));
    await user.tab();
    await waitFor(() =>
      expect(api.calls.filter((call) => call.key === 'PATCH /lists/7').map((call) => call.body)).toEqual([
        { priceMultiplier: 6.5 },
        { priceMultiplier: null },
      ]),
    );
  });

  it('refuses a multiplier out of range without sending it', async () => {
    serve(makeList({ priceMultiplier: 7, lines: [] }));
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    const field = await screen.findByLabelText('Multiplicador');
    await user.clear(field);
    await user.type(field, '80');
    await user.tab();
    expect(await screen.findByRole('alert')).toHaveTextContent('Use um número entre 1 e 50.');
    expect(api.calls.some((call) => call.key.startsWith('PATCH'))).toBe(false);
  });

  it('shows no multiplier or suggestion controls on a want list', async () => {
    serve(makeList({ kind: 'want', priceMultiplier: null, lines: [makeLine({ id: 1 })] }));
    const user = userEvent.setup();
    renderWithProviders(<ListEditor listId="7" />);

    const panel = await openPanel(user, /Editar Pummel/);
    expect(screen.queryByLabelText('Multiplicador')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Usar sugestões em todas' })).toBeNull();
    expect(within(panel).queryByTestId('suggestion-none')).toBeNull();
  });
});
