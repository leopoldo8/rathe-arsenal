import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ICardList } from '../../../api/lists';
import { createFakeApi, renderWithProviders, type IFakeApi } from '../../shared-deck/__tests__/sharingTestKit';
import { makeLine, makeList } from './listsTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});

import { SoldSheet, type ISoldFacts } from '../SoldSheet';

const KAYO = 'Kayo CC';

const FACTS: ISoldFacts = { owned: 4, held: 2, holder: KAYO, imports: [{ sourceId: 'imp-a', label: 'Minha planilha', quantity: 4 }] };

function lineOf(quantity: number): ReturnType<typeof makeLine> {
  return makeLine({
    id: 1,
    cardIdentifier: 'command-and-conquer-red',
    name: 'Command and Conquer',
    quantity,
    printingCode: 'HP1001',
    printingLabel: 'History Pack 1',
    condition: 'NM',
    priceCents: 4500,
  });
}

const REMOVED = [{ sourceId: 'imp-a', printingCode: 'HP1001', edition: '', finish: '', condition: 'NM', quantity: 2 }];

let api: IFakeApi;

function soldAnswer(list: ICardList, removed: readonly unknown[]): unknown {
  return { ...list, soldLineId: 1, removed };
}

function renderSheet(quantity: number, facts: ISoldFacts = FACTS): { onClose: ReturnType<typeof vi.fn> } {
  const onClose = vi.fn();
  const line = lineOf(quantity);
  renderWithProviders(<SoldSheet listId={7} line={line} facts={facts} onClose={onClose} />);
  return { onClose };
}

beforeEach(() => {
  api = createFakeApi();
  apiRef.current = api;
});

describe('SoldSheet', () => {
  it('asks how many, then about the collection', async () => {
    const user = userEvent.setup();
    api.handlers.set('POST /lists/7/lines/1/sold', () => soldAnswer(makeList({ id: 7 }), []));
    renderSheet(2);

    expect(screen.getByRole('heading', { name: 'Quantas você vendeu?' })).toBeInTheDocument();
    expect(screen.getByText('Command and Conquer (Vermelho) · History Pack 1 · NM')).toBeInTheDocument();
    const choices = within(screen.getByRole('group', { name: 'Quantas você vendeu?' })).getAllByRole('button');
    expect(choices.map((choice) => choice.textContent)).toEqual(['1', '2']);
    expect(screen.getByRole('heading', { name: 'Tirar da sua coleção também?' })).toBeInTheDocument();
    expect(screen.getByText('Você tem 4; ficam 2, as que o Kayo CC usa.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sim, tirar 2 da coleção' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Não, só marcar como vendida' })).toBeInTheDocument();
    expect(screen.getByText('Escolha "Não" se essas cópias não estavam no app.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1' }));
    expect(screen.getByText('Você tem 4; ficam 3.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sim, tirar 1 da coleção' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Não, só marcar como vendida' }));
    await waitFor(() => expect(api.calls.map((call) => call.key)).toContain('POST /lists/7/lines/1/sold'));
    expect(api.calls.find((call) => call.key === 'POST /lists/7/lines/1/sold')?.body).toEqual({ quantity: 1, removeFromCollection: false });
  });

  it('goes straight to the collection question on a line of 1', () => {
    renderSheet(1);

    expect(screen.queryByRole('heading', { name: 'Quantas você vendeu?' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tirar da sua coleção também?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sim, tirar 1 da coleção' })).toBeInTheDocument();
  });

  it('warns when the removal leaves a deck short', () => {
    renderSheet(3, { ...FACTS, held: 3 });

    expect(screen.getByText('O Kayo CC vai ficar faltando 2.')).toBeInTheDocument();
    expect(screen.queryByText(/ficam/)).not.toBeInTheDocument();
  });

  it('asks which import inside the sheet', async () => {
    const user = userEvent.setup();
    api.handlers.set('POST /lists/7/lines/1/sold', () => soldAnswer(makeList({ id: 7 }), REMOVED));
    renderSheet(2, {
      ...FACTS,
      imports: [
        { sourceId: 'imp-a', label: 'Minha planilha', quantity: 2 },
        { sourceId: 'imp-b', label: 'Entradas à mão', quantity: 2 },
      ],
    });

    await user.click(screen.getByRole('button', { name: 'Sim, tirar 2 da coleção' }));

    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByText('De qual importação tirar?')).toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: /Entradas à mão/ }));
    await waitFor(() => expect(api.calls.map((call) => call.key)).toContain('POST /lists/7/lines/1/sold'));
    expect(api.calls[0]?.body).toEqual({ quantity: 2, removeFromCollection: true, sourceId: 'imp-b' });
  });

  it('says how many copies left the collection', async () => {
    const user = userEvent.setup();
    api.handlers.set('POST /lists/7/lines/1/sold', () =>
      soldAnswer(makeList({ id: 7 }), [{ ...REMOVED[0]!, quantity: 1 }]),
    );
    renderSheet(2, { owned: 1, held: 0, holder: null, imports: [{ sourceId: 'imp-a', label: 'Minha planilha', quantity: 1 }] });

    expect(screen.getByText('Você tem 1; ficam 0.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sim, tirar 1 da coleção' }));

    expect(await screen.findByText('Tirei 1 cópia da coleção. Era só o que ela tinha.')).toBeInTheDocument();
  });

  it('Desfazer puts the copies back', async () => {
    const user = userEvent.setup();
    api.handlers.set('POST /lists/7/lines/1/sold', () => soldAnswer(makeList({ id: 7 }), REMOVED));
    api.handlers.set('POST /lists/7/lines/1/unsold', () => makeList({ id: 7 }));
    const { onClose } = renderSheet(2);

    await user.click(screen.getByRole('button', { name: 'Sim, tirar 2 da coleção' }));
    expect(await screen.findByText('Tirei 2 cópias da coleção.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => expect(api.calls.map((call) => call.key)).toContain('POST /lists/7/lines/1/unsold'));
    expect(api.calls.find((call) => call.key === 'POST /lists/7/lines/1/unsold')?.body).toEqual({ restore: REMOVED });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
